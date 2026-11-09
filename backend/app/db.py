"""SQLite engine and request-scoped database sessions."""

from collections.abc import Generator

from sqlalchemy import Connection, event, inspect, text
from sqlmodel import Session, SQLModel, create_engine

from app.config import get_settings

settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)


if settings.database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(connection: object, _record: object) -> None:
        cursor = connection.cursor()  # type: ignore[attr-defined]
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)
    with engine.begin() as conn:
        add_category_color_column(conn)


def add_category_color_column(conn: Connection) -> None:
    """Databases created before categories had a color: add the column and give the default
    categories their palette color. Alembic revision 20261109_0002 calls this too."""
    from app.services.defaults import DEFAULT_COLORS

    if "color" in {c["name"] for c in inspect(conn).get_columns("categories")}:
        return
    conn.execute(text("ALTER TABLE categories ADD COLUMN color VARCHAR(7) NOT NULL DEFAULT ''"))
    for name, color in DEFAULT_COLORS.items():
        conn.execute(
            text("UPDATE categories SET color = :color WHERE is_default AND name = :name"),
            {"color": color, "name": name},
        )


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
