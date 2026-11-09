"""Give categories a color.

Revision ID: 20261109_0002
Revises: 20261106_0001
"""

from alembic import op
from app.db import add_category_color_column

revision = "20261109_0002"
down_revision = "20261106_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The initial revision runs create_all, so a fresh database already has the column.
    add_category_color_column(op.get_bind())


def downgrade() -> None:
    with op.batch_alter_table("categories") as batch:
        batch.drop_column("color")
