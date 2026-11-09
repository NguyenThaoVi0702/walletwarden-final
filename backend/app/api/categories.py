from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import column
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.db import get_session
from app.models import Budget, Category, Transaction
from app.schemas.categories import CategoryCreate, CategoryPatch, CategoryRead
from app.security import CurrentUser

router = APIRouter()


def _owned_category(session: Session, user_id: int, category_id: int) -> Category:
    category = session.exec(
        select(Category).where(Category.id == category_id, Category.user_id == user_id)
    ).first()
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.get("", response_model=list[CategoryRead])
def list_categories(
    user: CurrentUser, session: Annotated[Session, Depends(get_session)]
) -> list[Category]:
    return list(
        session.exec(
            select(Category).where(Category.user_id == user.id).order_by(column("id"))
        ).all()
    )


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    body: CategoryCreate, user: CurrentUser, session: Annotated[Session, Depends(get_session)]
) -> Category:
    category = Category(user_id=user.id, **body.model_dump())
    session.add(category)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="Category name already exists") from None
    session.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int,
    body: CategoryPatch,
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> Category:
    category = _owned_category(session, user.id, category_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(category, field, value.strip() if field == "name" else value)
    try:
        session.add(category)
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="Category name already exists") from None
    session.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    user: CurrentUser,
    session: Annotated[Session, Depends(get_session)],
) -> None:
    category = _owned_category(session, user.id, category_id)
    if (
        session.exec(select(Transaction.id).where(Transaction.category_id == category_id)).first()
        is not None
        or session.exec(select(Budget.id).where(Budget.category_id == category_id)).first()
        is not None
    ):
        raise HTTPException(status_code=409, detail="Category is in use")
    session.delete(category)
    session.commit()
