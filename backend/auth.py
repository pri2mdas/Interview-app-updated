"""
Authentication helpers: password hashing, JWT issuing/verifying,
and a FastAPI dependency that resolves the current user from a Bearer token.
"""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from database import get_user_by_id, get_user_by_username

JWT_SECRET = os.environ.get("TMI_JWT_SECRET", "dev-only-secret-change-me-" + secrets.token_hex(16))
JWT_ALG = "HS256"
TOKEN_TTL_HOURS = int(os.environ.get("TMI_TOKEN_TTL_HOURS", "168"))  # 7 days

bearer_scheme = HTTPBearer(auto_error=False)


# ── Pydantic models ───────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: str
    username: str
    full_name: str
    password: str


class LoginRequest(BaseModel):
    # User can log in with either username or email.
    identifier: str
    password: str


class UserPublic(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str] = None
    created_at: str


# ── Password hashing ──────────────────────────────────────────────────────────
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ── JWT ───────────────────────────────────────────────────────────────────────
def create_access_token(user_id: int, username: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "username": username,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=TOKEN_TTL_HOURS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])


# ── Dependency ────────────────────────────────────────────────────────────────
def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
):
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(creds.credentials)
        user_id = int(payload.get("sub", "0"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists")
    return user


def get_optional_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
):
    """Like get_current_user but returns None instead of raising."""
    if creds is None or not creds.credentials:
        return None
    try:
        payload = decode_token(creds.credentials)
        user_id = int(payload.get("sub", "0"))
    except Exception:
        return None
    return get_user_by_id(user_id)


def user_to_public(user) -> UserPublic:
    return UserPublic(
        id=user["id"],
        email=user["email"],
        username=user["username"],
        full_name=user["full_name"],
        created_at=user["created_at"],
    )
