import os
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

ROOT_DIR = Path(__file__).parent

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required (postgresql+asyncpg://...)")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=int(os.environ.get("DB_POOL_SIZE", "10")),
    max_overflow=int(os.environ.get("DB_MAX_OVERFLOW", "20")),
    pool_recycle=int(os.environ.get("DB_POOL_RECYCLE", "1800")),
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


def run_migrations() -> None:
    """Apply Alembic migrations (idempotent: no-op when already at head)."""
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(ROOT_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT_DIR / "alembic"))
    command.upgrade(cfg, "head")
