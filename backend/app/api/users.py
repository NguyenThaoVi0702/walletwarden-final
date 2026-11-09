from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.models import User
from app.schemas.auth import SettingsPatch, UserRead
from app.security import CurrentUser

router = APIRouter()


@router.get("/me", response_model=UserRead)
def get_me(user: CurrentUser) -> User:
    return user


@router.patch("/me/settings", response_model=UserRead)
def update_settings(
    body: SettingsPatch,
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> User:
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(user, field, value)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user
