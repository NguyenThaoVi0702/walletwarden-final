from datetime import date as date_type
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TransactionCreate(BaseModel):
    kind: Literal["expense", "income"]
    amount: int = Field(gt=0, le=2_147_483_647)
    category_id: int = Field(gt=0)
    date: date_type
    note: str | None = Field(default=None, max_length=500)


class TransactionPatch(BaseModel):
    kind: Literal["expense", "income"] | None = None
    amount: int | None = Field(default=None, gt=0, le=2_147_483_647)
    category_id: int | None = Field(default=None, gt=0)
    date: date_type | None = None
    note: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def require_change(self) -> "TransactionPatch":
        if not self.model_fields_set:
            raise ValueError("At least one field is required")
        if any(
            getattr(self, field) is None
            for field in ("kind", "amount", "category_id", "date")
            if field in self.model_fields_set
        ):
            raise ValueError("Transaction fields cannot be null")
        return self


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: Literal["expense", "income"]
    amount: int
    category_id: int
    date: date_type
    note: str | None


class TransactionCreated(BaseModel):
    transaction: TransactionRead
    roast_pending: bool
