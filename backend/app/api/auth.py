"""Authentication routes: register, login, account deletion (synopsis Module 1)."""

import os
import shutil
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import QueryLog, User
from app.schemas import Token, UserLogin, UserOut, UserRegister
from app.security import create_access_token, hash_password, verify_password
from app.services import vector_store

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)) -> Token:
    exists = (
        db.query(User)
        .filter(or_(User.email == payload.email, User.username == payload.username))
        .first()
    )
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email or username already registered")

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.user_id), role=user.role)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> Token:
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")

    user.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.user_id), role=user.role)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user)


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Permanently delete the current user and all their data: documents,
    conversations/messages (DB cascade), vector chunks, and uploaded files."""
    user_id = str(current_user.user_id)

    # Remove the user's vectors from ChromaDB.
    try:
        vector_store.delete_user(user_id)
    except Exception:  # noqa: BLE001 - best effort; continue with account deletion
        pass

    # Remove the user's uploaded files.
    user_dir = os.path.join(settings.UPLOAD_DIR, user_id)
    if os.path.isdir(user_dir):
        shutil.rmtree(user_dir, ignore_errors=True)

    # Remove the user's query logs (they contain query text) for full privacy,
    # rather than leaving orphaned rows behind.
    db.query(QueryLog).filter(QueryLog.user_id == current_user.user_id).delete()

    # Delete the user; documents/conversations/messages cascade.
    db.delete(current_user)
    db.commit()
