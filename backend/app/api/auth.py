"""Authentication routes: register, login, password reset, account deletion (synopsis Module 1)."""

import os
import secrets
import shutil
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import PasswordResetToken, QueryLog, User
from app.services.rag_engine import WORK_ROLES
from app.schemas import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    PasswordChange,
    ProfileUpdate,
    ResetPasswordRequest,
    Token,
    UserLogin,
    UserOut,
    UserRegister,
)
from app.security import create_access_token, hash_password, verify_password
from app.services import vector_store

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Forgotten-password reset codes: short-lived, single-use. The alphabet omits
# easily confused characters (0/O, 1/I/L) so an on-screen code is easy to retype.
RESET_CODE_TTL_MINUTES = 15
_RESET_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _generate_reset_code() -> str:
    return "".join(secrets.choice(_RESET_ALPHABET) for _ in range(6))


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


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> ForgotPasswordResponse:
    """Issue a single-use reset code for a forgotten password.

    No email service is configured, so the code is returned for on-screen display
    (it stands in for an emailed reset link). Because the code is shown to whoever
    makes the request, this necessarily confirms whether an account exists — an
    accepted trade-off of the on-screen approach for this project.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No account found with that email address.")

    # Invalidate any earlier unused codes so only the latest one works.
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.user_id,
        PasswordResetToken.used.is_(False),
    ).update({"used": True})

    code = _generate_reset_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_CODE_TTL_MINUTES)
    db.add(
        PasswordResetToken(
            user_id=user.user_id,
            code_hash=hash_password(code),
            expires_at=expires_at,
        )
    )
    db.commit()
    return ForgotPasswordResponse(
        code=code, expires_at=expires_at, expires_in_minutes=RESET_CODE_TTL_MINUTES
    )


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> None:
    """Set a new password using a valid, unexpired, unused reset code."""
    user = db.query(User).filter(User.email == payload.email).first()
    # Uniform error so a bad email and a bad code look the same to the caller.
    invalid = HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired reset code.")
    if user is None:
        raise invalid

    token = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user.user_id,
            PasswordResetToken.used.is_(False),
        )
        .order_by(PasswordResetToken.created_at.desc())
        .first()
    )
    if token is None or token.expires_at < datetime.now(timezone.utc):
        raise invalid
    if not verify_password(payload.code.strip().upper(), token.code_hash):
        raise invalid

    user.password_hash = hash_password(payload.new_password)
    token.used = True
    db.commit()


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user)


@router.patch("/me", response_model=UserOut)
def update_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserOut:
    """Update the current user's display name and standing instructions."""
    if payload.username is not None:
        new_name = payload.username.strip()
        clash = (
            db.query(User)
            .filter(User.username == new_name, User.user_id != current_user.user_id)
            .first()
        )
        if clash:
            raise HTTPException(status.HTTP_409_CONFLICT, "That username is already taken")
        current_user.username = new_name
    # Sent-and-empty clears them; not sent at all leaves them be.
    if "custom_instructions" in payload.model_fields_set:
        text = (payload.custom_instructions or "").strip()
        current_user.custom_instructions = text or None
    if "work_role" in payload.model_fields_set:
        role = (payload.work_role or "").strip()
        if role and role not in WORK_ROLES:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown work role")
        current_user.work_role = role or None
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Change the current user's password after verifying the old one."""
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()


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
