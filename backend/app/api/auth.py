from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.api.rate_limit import limiter
from app.db import get_session
from app.models import User
from app.schemas.auth import LoginIn, RegisterIn, TokenResponse, UserRead
from app.security import create_access_token, hash_password, verify_password
from app.services.defaults import create_default_categories

router = APIRouter()
DbSession = Annotated[Session, Depends(get_session)]


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def register(body: RegisterIn, request: Request, session: DbSession) -> TokenResponse:
    if session.exec(select(User).where(User.email == body.email)).first() is not None:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        display_name=body.display_name,
    )
    session.add(user)
    try:
        session.flush()
        create_default_categories(session, user)
        session.commit()
        session.refresh(user)
        assert user.id is not None
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="Email already registered") from None
    return TokenResponse(
        access_token=create_access_token(user.id), user=UserRead.model_validate(user)
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(body: LoginIn, request: Request, session: DbSession) -> TokenResponse:
    user = session.exec(select(User).where(User.email == body.email.strip().lower())).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return TokenResponse(
        access_token=create_access_token(user.id), user=UserRead.model_validate(user)
    )
