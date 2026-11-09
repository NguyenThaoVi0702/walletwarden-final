"""Create WalletWarden tables.

Revision ID: 20261106_0001
Revises:
"""

from sqlmodel import SQLModel

from alembic import op
from app import models  # noqa: F401

revision = "20261106_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    SQLModel.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    SQLModel.metadata.drop_all(bind=op.get_bind())
