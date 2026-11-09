import re

from pydantic import BaseModel, Field, field_validator


class CategoryBudgetIn(BaseModel):
    category_id: int = Field(gt=0)
    limit: int = Field(gt=0, le=2_147_483_647)


class BudgetUpdate(BaseModel):
    month: str
    total: int | None = Field(default=None, gt=0, le=2_147_483_647)
    categories: list[CategoryBudgetIn] = Field(default_factory=list, max_length=30)

    @field_validator("month")
    @classmethod
    def valid_month(cls, value: str) -> str:
        if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", value):
            raise ValueError("month must use YYYY-MM")
        return value


class BudgetLine(BaseModel):
    category_id: int | None
    name: str | None
    limit: int
    spent: int
    usage_pct: int


class BudgetStatus(BaseModel):
    month: str
    total: BudgetLine | None
    categories: list[BudgetLine]


class DashboardCategory(BaseModel):
    category_id: int
    name: str
    amount: int


class DashboardDayCategory(BaseModel):
    category_id: int
    amount: int


class DashboardDay(BaseModel):
    date: str
    income: int
    expense: int
    # The day's expense split by category (largest first), for the stacked daily chart.
    categories: list[DashboardDayCategory] = []


class DashboardResponse(BaseModel):
    month: str
    income: int
    expense: int
    balance: int
    by_category: list[DashboardCategory]
    daily: list[DashboardDay]
