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
from app.models import PasswordResetToken, QueryLog, RefreshToken, User
from app.services.rag_engine import WORK_ROLES
from app.schemas import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    PasswordChange,
    ProfileUpdate,
    RefreshRequest,
    ResetPasswordRequest,
    Token,
    UserLogin,
    UserOut,
    UserRegister,
)
from app.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    refresh_token_expiry,
    verify_password,
)
from app.services import vector_store

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Forgotten-password reset codes: short-lived, single-use. The alphabet omits
# easily confused characters (0/O, 1/I/L) so an on-screen code is easy to retype.
RESET_CODE_TTL_MINUTES = 15
_RESET_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _generate_reset_code() -> str:
    return "".join(secrets.choice(_RESET_ALPHABET) for _ in range(6))


def _revoke_all(db: Session, user_id) -> None:
    """Withdraw every live session a user has.

    Called when the password changes and when a rotated token is presented a
    second time. Both mean the same thing: whatever else is holding a token for
    this account should stop working now.
    """
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked.is_(False),
    ).update({"revoked": True})


def _prune_expired(db: Session, user_id) -> None:
    """Drop this user's dead rows. Cheap, and it keeps the table from growing
    by one row an hour forever."""
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.expires_at < datetime.now(timezone.utc),
    ).delete(synchronize_session=False)


def _mint_session(db: Session, user: User) -> tuple[Token, RefreshToken]:
    """Mint an access/refresh pair and stage the refresh half for writing.

    Every route that starts or continues a session ends here, so there is one
    place that decides what a session is worth. It flushes rather than commits,
    which is what lets a refresh revoke the old token and write the new one in
    the same transaction: either both happen or neither does, and there is no
    instant when a rotated token and its replacement are both live.
    """
    raw = new_refresh_token()
    row = RefreshToken(
        user_id=user.user_id,
        token_hash=hash_refresh_token(raw),
        expires_at=refresh_token_expiry(),
    )
    db.add(row)
    db.flush()  # assigns token_id, without ending the transaction
    return (
        Token(
            access_token=create_access_token(subject=str(user.user_id), role=user.role),
            refresh_token=raw,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserOut.model_validate(user),
        ),
        row,
    )


def _issue_session(db: Session, user: User) -> Token:
    """Mint a pair and commit it. For the routes that have nothing else to say."""
    token, _ = _mint_session(db, user)
    db.commit()
    return token


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

    return _issue_session(db, user)


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> Token:
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")

    user.last_login = datetime.now(timezone.utc)
    _prune_expired(db, user.user_id)
    return _issue_session(db, user)


@router.post("/refresh", response_model=Token)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> Token:
    """Trade a refresh token for a new access token, and a new refresh token.

    The old one is spent in the process. Rotating on every use is what makes a
    stolen token detectable: the real client and the thief cannot both keep
    refreshing, and whichever presents the spent token second gives the theft
    away. When that happens every session for the account is withdrawn, which
    is heavy-handed on purpose. Losing a session is a nuisance; leaving a copied
    token working for a month is not.
    """
    invalid = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")

    row = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == hash_refresh_token(payload.refresh_token))
        .first()
    )
    if row is None:
        raise invalid

    if row.revoked:
        # Revoked for two quite different reasons, and only one of them is
        # alarming. A token with a successor was spent in a rotation and is now
        # being presented a second time, which means two clients hold it: end
        # everything. A token with no successor was withdrawn on purpose, by a
        # sign-out or a password change, and meeting it again is just a stale
        # tab. Treating the second case as theft would let signing out of one
        # tab sign the user out of every device they own.
        if row.replaced_by is not None:
            _revoke_all(db, row.user_id)
            db.commit()
        raise invalid

    if row.expires_at < datetime.now(timezone.utc):
        raise invalid

    user = db.get(User, row.user_id)
    if user is None or not user.is_active:
        raise invalid

    token, successor = _mint_session(db, user)
    row.revoked = True
    row.last_used_at = datetime.now(timezone.utc)
    row.replaced_by = successor.token_id
    db.commit()
    return token


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: RefreshRequest, db: Session = Depends(get_db)) -> None:
    """End a session on the server as well as in the browser.

    Clearing the browser's copy was all sign-out could do while the access token
    was the whole session. Now the refresh token is the part that outlives the
    tab, so signing out has to reach the server to be worth anything. No
    authentication is required: presenting the token is the proof, and a request
    to throw a credential away is not one worth refusing.
    """
    db.query(RefreshToken).filter(
        RefreshToken.token_hash == hash_refresh_token(payload.refresh_token)
    ).update({"revoked": True})
    db.commit()


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
    # Whoever knew the old password may still be holding a session.
    _revoke_all(db, user.user_id)
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


@router.post("/change-password", response_model=Token)
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Token:
    """Change the current user's password after verifying the old one.

    Every session the account had is withdrawn, including this one, and a new
    pair is issued to the caller. So a password changed because it may have
    leaked ends every other sign-in on every other machine, while the person who
    changed it carries on without being thrown back to the login screen.
    """
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    current_user.password_hash = hash_password(payload.new_password)
    _revoke_all(db, current_user.user_id)
    db.commit()
    return _issue_session(db, current_user)


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
