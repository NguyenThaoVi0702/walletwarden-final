from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

CategoryKind = Literal["expense", "income"]
# "#rrggbb", or "" to let the app choose from its palette.
COLOR_PATTERN = r"^(#[0-9a-fA-F]{6})?$"


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    kind: CategoryKind
    icon: str = Field(default="", max_length=40)
    color: str = Field(default="", pattern=COLOR_PATTERN)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Category name cannot be empty")
        return value


class CategoryPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    kind: CategoryKind | None = None
    icon: str | None = Field(default=None, max_length=40)
    color: str | None = Field(default=None, pattern=COLOR_PATTERN)

    @model_validator(mode="after")
    def require_change(self) -> "CategoryPatch":
        if not self.model_fields_set:
            raise ValueError("At least one field is required")
        if any(
            getattr(self, field) is None
            for field in ("name", "kind")
            if field in self.model_fields_set
        ):
            raise ValueError("Name and kind cannot be null")
        if self.name is not None:
            self.name = self.name.strip()
            if not self.name:
                raise ValueError("Category name cannot be empty")
        return self


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    kind: CategoryKind
    icon: str
    color: str
    is_default: bool
