"""add-metadata-to-case-metric-link

Revision ID: b7a4d1e2c3f4
Revises: 15465cf380bc
Create Date: 2026-06-07 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7a4d1e2c3f4"
down_revision: str | None = "15465cf380bc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("casemetriclink", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "metadata",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'{}'"),
            )
        )

    with op.batch_alter_table("casemetriclink", schema=None) as batch_op:
        batch_op.alter_column("metadata", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("casemetriclink", schema=None) as batch_op:
        batch_op.drop_column("metadata")
