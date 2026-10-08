from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Index,
    Integer, LargeBinary, Numeric, String, Text, func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=utcnow)


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    public_id: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    picture: Mapped[str] = mapped_column(Text, nullable=False, default="")
    password_hash: Mapped[str | None] = mapped_column(String(200), nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(20), nullable=False, default="email")

    bankrolls: Mapped[list["Bankroll"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    settings: Mapped["Settings"] = relationship(back_populates="user", uselist=False,
                                                cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("auth_provider in ('email','google')", name="ck_users_auth_provider"),
    )


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_token: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index("ix_user_sessions_expires_at", "expires_at"),
    )


class Bankroll(TimestampMixin, Base):
    __tablename__ = "bankrolls"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    public_id: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    starting_bankroll: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="HUF")
    unit_size: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False, default=0)
    profit_goal: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False, default=0)
    daily_limit: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False, default=0)
    weekly_limit: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False, default=0)

    user: Mapped["User"] = relationship(back_populates="bankrolls")
    bets: Mapped[list["Bet"]] = relationship(back_populates="bankroll", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_bankrolls_user_created", "user_id", "created_at"),
    )


class Settings(TimestampMixin, Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    onboarded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    active_bankroll_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("bankrolls.id", ondelete="SET NULL"), nullable=True)

    user: Mapped["User"] = relationship(back_populates="settings")


class Bet(TimestampMixin, Base):
    __tablename__ = "bets"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    public_id: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    bankroll_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("bankrolls.id", ondelete="CASCADE"), nullable=False)
    bet_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sport: Mapped[str] = mapped_column(String(80), nullable=False, default="Egyéb")
    market: Mapped[str] = mapped_column(String(120), nullable=False, default="Meccs kimenetel")
    selection: Mapped[str] = mapped_column(Text, nullable=False, default="")
    stake: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False)
    odds: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False)
    units: Mapped[float | None] = mapped_column(Numeric(12, 3), nullable=True)
    result: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    bookmaker: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    profit: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False, default=0)

    bankroll: Mapped["Bankroll"] = relationship(back_populates="bets")

    __table_args__ = (
        CheckConstraint("result in ('win','lose','void','half_win','half_lose','pending')",
                        name="ck_bets_result"),
        Index("ix_bets_user_bankroll_date", "user_id", "bankroll_id", "bet_date"),
        Index("ix_bets_bankroll_id", "bankroll_id"),
    )


class Report(TimestampMixin, Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    public_id: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename: Mapped[str] = mapped_column(String(200), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pdf_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        Index("ix_reports_user_created", "user_id", "created_at"),
    )
