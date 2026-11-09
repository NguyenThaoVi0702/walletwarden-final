"""SQLModel database tables for WalletWarden."""

from datetime import UTC, datetime
from datetime import date as date_type

from sqlalchemy import Column, Integer, String, UniqueConstraint
from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int = Field(default=None, primary_key=True)
    email: str = Field(sa_type=String(320), unique=True, index=True)
    password_hash: str = Field(sa_type=String(512))
    display_name: str = Field(sa_type=String(80))
    roast_enabled: bool = Field(default=True)
    roast_tone: str = Field(default="honest", sa_type=String(16))


class Category(SQLModel, table=True):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_category_user_name"),)

    id: int = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    name: str = Field(sa_type=String(60))
    kind: str = Field(sa_type=String(12))
    icon: str = Field(default="", sa_type=String(40))
    # "#rrggbb" picked by the user; "" = let the app pick one from its palette.
    color: str = Field(default="", sa_type=String(7))
    is_default: bool = Field(default=False)


class Transaction(SQLModel, table=True):
    __tablename__ = "transactions"

    id: int = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    kind: str = Field(sa_type=String(12))
    amount: int = Field(gt=0)
    category_id: int = Field(foreign_key="categories.id", index=True)
    date: date_type = Field(index=True)
    note: str | None = Field(default=None, sa_type=String(500))


class Budget(SQLModel, table=True):
    __tablename__ = "budgets"
    __table_args__ = (UniqueConstraint("user_id", "month", "category_id", name="uq_budget_scope"),)

    id: int = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    month: str = Field(sa_type=String(7), index=True)
    category_id: int | None = Field(default=None, foreign_key="categories.id")
    limit: int = Field(sa_column=Column("limit", Integer, nullable=False))


class AIMessage(SQLModel, table=True):
    __tablename__ = "ai_messages"

    id: int = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    kind: str = Field(default="roast", sa_type=String(16))
    trigger_name: str | None = Field(default=None, sa_column=Column("trigger", String(40)))
    tone: str | None = Field(default=None, sa_type=String(16))
    category: str | None = Field(default=None, sa_type=String(60))
    text: str = Field(sa_type=String(2000))
    provider: str = Field(sa_type=String(16))
    read: bool = Field(default=False)
    reported: bool = Field(default=False)
    roast_key: str | None = Field(default=None, index=True, sa_type=String(200))
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)
