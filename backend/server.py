import os
import uuid
import csv
import io
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Header, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy import delete, func, select, update
import bcrypt
import jwt
import httpx
import requests

from db import SessionLocal, engine, run_migrations
from models import Bankroll, Bet, Report, Settings, User, UserSession

# ---------------- Config ----------------
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required (no insecure fallback allowed)")
JWT_ALGORITHM = "HS256"
COOKIE_SECURE = os.environ.get('COOKIE_SECURE', 'true').lower() == 'true'
COOKIE_SAMESITE = os.environ.get('COOKIE_SAMESITE', 'lax').lower()

# Google OAuth 2.0 (only active when both env vars are set)
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

APP_NAME = "bettrackerpro"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------- Login rate limiting (in-memory, per IP+email) ----------------
LOGIN_MAX_ATTEMPTS = int(os.environ.get('LOGIN_MAX_ATTEMPTS', '5'))
LOGIN_WINDOW_SECONDS = int(os.environ.get('LOGIN_WINDOW_SECONDS', '900'))
LOGIN_ATTEMPTS: dict = {}


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def login_rate_limited(key: str) -> bool:
    now = datetime.now(timezone.utc).timestamp()
    hits = [t for t in LOGIN_ATTEMPTS.get(key, []) if now - t < LOGIN_WINDOW_SECONDS]
    LOGIN_ATTEMPTS[key] = hits
    return len(hits) >= LOGIN_MAX_ATTEMPTS


def register_login_failure(key: str) -> None:
    LOGIN_ATTEMPTS.setdefault(key, []).append(datetime.now(timezone.utc).timestamp())


# ---------------- Auth helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def set_auth_cookie(response: Response, key: str, value: str, max_age: int):
    response.set_cookie(key=key, value=value, httponly=True, secure=COOKIE_SECURE,
                        samesite=COOKIE_SAMESITE, max_age=max_age, path="/")


def user_row_to_dict(u: User) -> dict:
    return {"id": u.id, "user_id": u.public_id, "email": u.email, "name": u.name,
            "picture": u.picture, "auth_provider": u.auth_provider,
            "created_at": u.created_at.isoformat() if u.created_at else None}


async def get_current_user(request: Request) -> dict:
    # 1) Google session_token cookie / bearer
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]

    async with SessionLocal() as s:
        if session_token:
            row = (await s.execute(
                select(User, UserSession.expires_at)
                .join(UserSession, UserSession.user_id == User.id)
                .where(UserSession.session_token == session_token)
            )).first()
            if row:
                user, expires_at = row
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at >= datetime.now(timezone.utc):
                    return user_row_to_dict(user)

        # 2) JWT access token (cookie or bearer)
        token = request.cookies.get("access_token")
        if not token:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]
        if not token:
            raise HTTPException(status_code=401, detail="Nincs bejelentkezve")
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Lejárt munkamenet")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Érvénytelen token")
        user = (await s.execute(select(User).where(User.public_id == payload["sub"]))).scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="Felhasználó nem található")
        return user_row_to_dict(user)


# ---------------- Models ----------------
class RegisterInput(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = ""

class LoginInput(BaseModel):
    email: EmailStr
    password: str

class BetInput(BaseModel):
    date: Optional[str] = None
    sport: str
    market: str = "Meccs kimenetel"
    selection: str = ""
    stake: float
    odds: float
    units: Optional[float] = None
    result: str = "pending"   # win | lose | void | half_win | half_lose | pending
    bookmaker: Optional[str] = ""
    note: Optional[str] = ""

class SettingsInput(BaseModel):
    starting_bankroll: Optional[float] = None
    currency: Optional[str] = None
    unit_size: Optional[float] = None
    profit_goal: Optional[float] = None
    daily_limit: Optional[float] = None
    weekly_limit: Optional[float] = None
    onboarded: Optional[bool] = None


class BankrollCreate(BaseModel):
    name: str
    starting_bankroll: float = 100000
    currency: str = "HUF"


class BankrollUpdate(BaseModel):
    name: Optional[str] = None
    starting_bankroll: Optional[float] = None
    currency: Optional[str] = None
    unit_size: Optional[float] = None
    profit_goal: Optional[float] = None
    daily_limit: Optional[float] = None
    weekly_limit: Optional[float] = None


def compute_profit(stake: float, odds: float, result: str) -> float:
    if result == "win":
        return round(stake * (odds - 1), 2)
    if result == "lose":
        return round(-stake, 2)
    if result == "void" or result == "pending":
        return 0.0
    if result == "half_win":
        return round(stake * (odds - 1) / 2, 2)
    if result == "half_lose":
        return round(-stake / 2, 2)
    return 0.0


def public_user(u: dict) -> dict:
    return {"user_id": u["user_id"], "email": u.get("email"), "name": u.get("name", ""),
            "picture": u.get("picture", ""), "auth_provider": u.get("auth_provider", "email")}


DEFAULT_BANKROLL = {"starting_bankroll": 100000, "currency": "HUF",
                    "unit_size": 1000, "profit_goal": 0, "daily_limit": 0, "weekly_limit": 0}


def _f(v) -> float:
    return float(v) if v is not None else 0.0


def bankroll_dict(br: Bankroll, user_public_id: str) -> dict:
    return {"bankroll_id": br.public_id, "user_id": user_public_id, "name": br.name,
            "starting_bankroll": _f(br.starting_bankroll), "currency": br.currency,
            "unit_size": _f(br.unit_size), "profit_goal": _f(br.profit_goal),
            "daily_limit": _f(br.daily_limit), "weekly_limit": _f(br.weekly_limit),
            "created_at": br.created_at.isoformat() if br.created_at else None}


def bet_dict(b: Bet, user_public_id: str, bankroll_public_id: str) -> dict:
    return {"bet_id": b.public_id, "user_id": user_public_id, "bankroll_id": bankroll_public_id,
            "date": b.bet_date.isoformat(), "sport": b.sport, "market": b.market,
            "selection": b.selection, "stake": _f(b.stake), "odds": _f(b.odds),
            "units": float(b.units) if b.units is not None else None,
            "result": b.result, "bookmaker": b.bookmaker, "note": b.note,
            "profit": _f(b.profit),
            "created_at": b.created_at.isoformat() if b.created_at else None}


def report_dict(r: Report, user_public_id: str) -> dict:
    return {"report_id": r.public_id, "user_id": user_public_id, "filename": r.filename,
            "size": r.size, "is_deleted": r.is_deleted,
            "created_at": r.created_at.isoformat() if r.created_at else None}


async def get_or_create_settings(s, user_db_id: int) -> Settings:
    st = (await s.execute(select(Settings).where(Settings.user_id == user_db_id))).scalar_one_or_none()
    if not st:
        st = Settings(user_id=user_db_id, onboarded=False, active_bankroll_id=None)
        s.add(st)
        await s.flush()
    return st


async def ensure_bankrolls(s, user_db_id: int) -> Bankroll:
    """Ensure the user has >=1 bankroll and return the active one."""
    st = await get_or_create_settings(s, user_db_id)
    count = (await s.execute(
        select(func.count(Bankroll.id)).where(Bankroll.user_id == user_db_id))).scalar_one()
    if count == 0:
        br = Bankroll(public_id=f"br_{uuid.uuid4().hex[:12]}", user_id=user_db_id,
                      name="Fő bankroll", **DEFAULT_BANKROLL)
        s.add(br)
        await s.flush()
        st.active_bankroll_id = br.id
        await s.flush()
        return br
    active = None
    if st.active_bankroll_id:
        active = (await s.execute(
            select(Bankroll).where(Bankroll.id == st.active_bankroll_id,
                                   Bankroll.user_id == user_db_id))).scalar_one_or_none()
    if not active:
        active = (await s.execute(
            select(Bankroll).where(Bankroll.user_id == user_db_id)
            .order_by(Bankroll.created_at, Bankroll.id).limit(1))).scalar_one()
        st.active_bankroll_id = active.id
        await s.flush()
    return active


# ---------------- Auth routes ----------------
@api_router.post("/auth/register")
async def register(input: RegisterInput, response: Response):
    email = input.email.lower()
    async with SessionLocal() as s:
        exists = (await s.execute(select(User.id).where(User.email == email))).scalar_one_or_none()
        if exists:
            raise HTTPException(status_code=400, detail="Ez az email már regisztrálva van")
        user = User(public_id=f"user_{uuid.uuid4().hex[:12]}", email=email,
                    name=input.name or email.split("@")[0],
                    password_hash=hash_password(input.password), picture="",
                    auth_provider="email")
        s.add(user)
        await s.flush()
        await ensure_bankrolls(s, user.id)
        await s.commit()
        token = create_access_token(user.public_id, email)
        set_auth_cookie(response, "access_token", token, 604800)
        return {**public_user(user_row_to_dict(user)), "access_token": token}


@api_router.post("/auth/login")
async def login(input: LoginInput, request: Request, response: Response):
    email = input.email.lower()
    rl_key = f"{client_ip(request)}|{email}"
    if login_rate_limited(rl_key):
        raise HTTPException(status_code=429, detail="Túl sok sikertelen bejelentkezési próbálkozás. Próbáld újra később.")
    async with SessionLocal() as s:
        user = (await s.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if not user or not user.password_hash or not verify_password(input.password, user.password_hash):
            register_login_failure(rl_key)
            raise HTTPException(status_code=401, detail="Hibás email vagy jelszó")
        LOGIN_ATTEMPTS.pop(rl_key, None)
        token = create_access_token(user.public_id, email)
        set_auth_cookie(response, "access_token", token, 604800)
        return {**public_user(user_row_to_dict(user)), "access_token": token}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        async with SessionLocal() as s:
            await s.execute(delete(UserSession).where(UserSession.session_token == session_token))
            await s.commit()
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------------- Google OAuth 2.0 ----------------
# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
def _google_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)


def _sign_oauth_state(payload: dict) -> str:
    payload = {**payload, "exp": datetime.now(timezone.utc) + timedelta(minutes=10), "type": "oauth_state"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _verify_oauth_state(token: str) -> dict:
    data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    if data.get("type") != "oauth_state":
        raise jwt.InvalidTokenError("bad type")
    return data


def _build_google_redirect_uri(request: Request) -> str:
    return f"{str(request.base_url).rstrip('/')}/api/auth/google/callback"


@api_router.get("/auth/google/config")
async def google_config():
    return {"enabled": _google_configured()}


@api_router.get("/auth/google/login")
async def google_login(request: Request):
    if not _google_configured():
        raise HTTPException(status_code=503, detail="Google bejelentkezés nincs konfigurálva")
    from urllib.parse import urlencode
    redirect_uri = _build_google_redirect_uri(request)
    state = _sign_oauth_state({"nonce": uuid.uuid4().hex, "redirect_uri": redirect_uri})
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
        "state": state,
    }
    return {"url": f"{GOOGLE_AUTH_URL}?{urlencode(params)}"}


@api_router.get("/auth/google/callback")
async def google_callback(request: Request, code: str = Query(...), state: str = Query(...)):
    from fastapi.responses import RedirectResponse
    from urllib.parse import quote

    origin = str(request.base_url).rstrip("/")
    if not _google_configured():
        return RedirectResponse(url=f"{origin}/belepes?error=google_disabled", status_code=302)
    try:
        state_data = _verify_oauth_state(state)
    except Exception:
        return RedirectResponse(url=f"{origin}/belepes?error=invalid_state", status_code=302)

    redirect_uri = state_data.get("redirect_uri") or _build_google_redirect_uri(request)
    try:
        async with httpx.AsyncClient(timeout=15) as hc:
            token_resp = await hc.post(GOOGLE_TOKEN_URL, data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            })
            if token_resp.status_code != 200:
                logger.warning("Google token exchange failed: %s", token_resp.text[:200])
                return RedirectResponse(url=f"{origin}/belepes?error=google_token", status_code=302)
            access_token = token_resp.json().get("access_token")
            user_resp = await hc.get(GOOGLE_USERINFO_URL,
                                     headers={"Authorization": f"Bearer {access_token}"})
            if user_resp.status_code != 200:
                logger.warning("Google userinfo failed: %s", user_resp.text[:200])
                return RedirectResponse(url=f"{origin}/belepes?error=google_userinfo", status_code=302)
            info = user_resp.json()
    except httpx.HTTPError as e:
        logger.warning("Google OAuth network error: %s", e)
        return RedirectResponse(url=f"{origin}/belepes?error=google_network", status_code=302)

    email = (info.get("email") or "").lower()
    if not email:
        return RedirectResponse(url=f"{origin}/belepes?error=google_no_email", status_code=302)

    async with SessionLocal() as s:
        user = (await s.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if not user:
            user = User(public_id=f"user_{uuid.uuid4().hex[:12]}", email=email,
                        name=info.get("name", ""), picture=info.get("picture", ""),
                        auth_provider="google")
            s.add(user)
            await s.flush()
            await ensure_bankrolls(s, user.id)
        else:
            user.picture = info.get("picture", user.picture)
            user.name = info.get("name", user.name)
        await s.commit()
        public_id = user.public_id

    jwt_token = create_access_token(public_id, email)
    redirect = RedirectResponse(url=f"{origin}/?google_token={quote(jwt_token)}", status_code=302)
    redirect.set_cookie(key="access_token", value=jwt_token, httponly=True,
                        secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE,
                        max_age=604800, path="/")
    return redirect


# ---------------- Settings routes ----------------
@api_router.get("/settings")
async def read_settings(user: dict = Depends(get_current_user)):
    async with SessionLocal() as s:
        active = await ensure_bankrolls(s, user["id"])
        st = await get_or_create_settings(s, user["id"])
        payload = {**bankroll_dict(active, user["user_id"]), "onboarded": bool(st.onboarded),
                   "active_bankroll_id": active.public_id}
        await s.commit()
        return payload


@api_router.put("/settings")
async def update_settings(input: SettingsInput, user: dict = Depends(get_current_user)):
    async with SessionLocal() as s:
        active = await ensure_bankrolls(s, user["id"])
        st = await get_or_create_settings(s, user["id"])
        data = input.model_dump()
        onboarded = data.pop("onboarded", None)
        for k, v in data.items():
            if v is not None:
                setattr(active, k, v)
        if onboarded is not None:
            st.onboarded = onboarded
        await s.flush()
        payload = {**bankroll_dict(active, user["user_id"]), "onboarded": bool(st.onboarded),
                   "active_bankroll_id": active.public_id}
        await s.commit()
        return payload


# ---------------- Bankroll routes ----------------
@api_router.get("/bankrolls")
async def list_bankrolls(user: dict = Depends(get_current_user)):
    async with SessionLocal() as s:
        active = await ensure_bankrolls(s, user["id"])
        rows = (await s.execute(
            select(Bankroll).where(Bankroll.user_id == user["id"])
            .order_by(Bankroll.created_at, Bankroll.id).limit(200))).scalars().all()
        payload = {"bankrolls": [bankroll_dict(b, user["user_id"]) for b in rows],
                   "active_bankroll_id": active.public_id}
        await s.commit()
        return payload


@api_router.post("/bankrolls")
async def create_bankroll(input: BankrollCreate, user: dict = Depends(get_current_user)):
    async with SessionLocal() as s:
        await ensure_bankrolls(s, user["id"])
        st = await get_or_create_settings(s, user["id"])
        br = Bankroll(public_id=f"br_{uuid.uuid4().hex[:12]}", user_id=user["id"],
                      name=(input.name or "").strip() or "Új bankroll",
                      starting_bankroll=input.starting_bankroll, currency=input.currency,
                      unit_size=DEFAULT_BANKROLL["unit_size"],
                      profit_goal=DEFAULT_BANKROLL["profit_goal"],
                      daily_limit=DEFAULT_BANKROLL["daily_limit"],
                      weekly_limit=DEFAULT_BANKROLL["weekly_limit"])
        s.add(br)
        await s.flush()
        st.active_bankroll_id = br.id
        payload = bankroll_dict(br, user["user_id"])
        await s.commit()
        return payload


@api_router.put("/bankrolls/{bankroll_id}")
async def update_bankroll(bankroll_id: str, input: BankrollUpdate, user: dict = Depends(get_current_user)):
    async with SessionLocal() as s:
        br = (await s.execute(select(Bankroll).where(
            Bankroll.public_id == bankroll_id, Bankroll.user_id == user["id"]))).scalar_one_or_none()
        if not br:
            raise HTTPException(status_code=404, detail="Bankroll nem található")
        updates = {k: v for k, v in input.model_dump().items() if v is not None}
        if "name" in updates:
            updates["name"] = updates["name"].strip() or br.name
        for k, v in updates.items():
            setattr(br, k, v)
        await s.flush()
        payload = bankroll_dict(br, user["user_id"])
        await s.commit()
        return payload


@api_router.delete("/bankrolls/{bankroll_id}")
async def delete_bankroll(bankroll_id: str, user: dict = Depends(get_current_user)):
    async with SessionLocal() as s:
        br = (await s.execute(select(Bankroll).where(
            Bankroll.public_id == bankroll_id, Bankroll.user_id == user["id"]))).scalar_one_or_none()
        if not br:
            raise HTTPException(status_code=404, detail="Bankroll nem található")
        count = (await s.execute(
            select(func.count(Bankroll.id)).where(Bankroll.user_id == user["id"]))).scalar_one()
        if count <= 1:
            raise HTTPException(status_code=400, detail="Legalább egy bankroll szükséges")
        st = await get_or_create_settings(s, user["id"])
        was_active = st.active_bankroll_id == br.id
        # bets are removed by the FK cascade on bankrolls
        await s.delete(br)
        await s.flush()
        if was_active:
            other = (await s.execute(
                select(Bankroll).where(Bankroll.user_id == user["id"])
                .order_by(Bankroll.created_at, Bankroll.id).limit(1))).scalar_one()
            st.active_bankroll_id = other.id
        await s.commit()
        return {"ok": True}


@api_router.post("/bankrolls/{bankroll_id}/activate")
async def activate_bankroll(bankroll_id: str, user: dict = Depends(get_current_user)):
    async with SessionLocal() as s:
        br = (await s.execute(select(Bankroll).where(
            Bankroll.public_id == bankroll_id, Bankroll.user_id == user["id"]))).scalar_one_or_none()
        if not br:
            raise HTTPException(status_code=404, detail="Bankroll nem található")
        st = await get_or_create_settings(s, user["id"])
        st.active_bankroll_id = br.id
        await s.commit()
        return {"active_bankroll_id": bankroll_id}


# ---------------- Bets routes ----------------
@api_router.get("/bets")
async def list_bets(user: dict = Depends(get_current_user),
                    limit: int = Query(2000, ge=1, le=2000),
                    offset: int = Query(0, ge=0)):
    async with SessionLocal() as s:
        active = await ensure_bankrolls(s, user["id"])
        rows = (await s.execute(
            select(Bet).where(Bet.user_id == user["id"], Bet.bankroll_id == active.id)
            .order_by(Bet.bet_date.desc(), Bet.id.desc())
            .limit(limit).offset(offset))).scalars().all()
        payload = [bet_dict(b, user["user_id"], active.public_id) for b in rows]
        await s.commit()
        return payload


@api_router.post("/bets")
async def create_bet(input: BetInput, user: dict = Depends(get_current_user)):
    async with SessionLocal() as s:
        active = await ensure_bankrolls(s, user["id"])
        bet = Bet(public_id=f"bet_{uuid.uuid4().hex[:12]}", user_id=user["id"],
                  bankroll_id=active.id, bet_date=_parse_date_flexible(input.date),
                  sport=input.sport, market=input.market, selection=input.selection or "",
                  stake=input.stake, odds=input.odds, units=input.units, result=input.result,
                  bookmaker=input.bookmaker or "", note=input.note or "",
                  profit=compute_profit(input.stake, input.odds, input.result))
        s.add(bet)
        await s.flush()
        payload = bet_dict(bet, user["user_id"], active.public_id)
        await s.commit()
        return payload


@api_router.put("/bets/{bet_id}")
async def update_bet(bet_id: str, input: BetInput, user: dict = Depends(get_current_user)):
    async with SessionLocal() as s:
        row = (await s.execute(
            select(Bet, Bankroll.public_id).join(Bankroll, Bankroll.id == Bet.bankroll_id)
            .where(Bet.public_id == bet_id, Bet.user_id == user["id"]))).first()
        if not row:
            raise HTTPException(status_code=404, detail="Fogadás nem található")
        bet, br_public_id = row
        data = input.model_dump()
        date_raw = data.pop("date", None)
        if date_raw:
            bet.bet_date = _parse_date_flexible(date_raw)
        for k, v in data.items():
            setattr(bet, k, v if v is not None else getattr(bet, k))
        bet.selection = input.selection or ""
        bet.bookmaker = input.bookmaker or ""
        bet.note = input.note or ""
        bet.units = input.units
        bet.profit = compute_profit(input.stake, input.odds, input.result)
        await s.flush()
        payload = bet_dict(bet, user["user_id"], br_public_id)
        await s.commit()
        return payload


@api_router.delete("/bets/{bet_id}")
async def delete_bet(bet_id: str, user: dict = Depends(get_current_user)):
    async with SessionLocal() as s:
        res = await s.execute(delete(Bet).where(Bet.public_id == bet_id, Bet.user_id == user["id"]))
        await s.commit()
        if res.rowcount == 0:
            raise HTTPException(status_code=404, detail="Fogadás nem található")
        return {"ok": True}


# ---------------- Import ----------------
RESULT_ALIASES = {
    "nyert": "win", "win": "win", "won": "win",
    "vesztett": "lose", "veszített": "lose", "lose": "lose", "lost": "lose",
    "érvénytelen": "void", "ervenytelen": "void", "void": "void", "push": "void",
    "fél nyerés": "half_win", "fel nyeres": "half_win", "half_win": "half_win", "half win": "half_win",
    "fél vesztés": "half_lose", "fel vesztes": "half_lose", "half_lose": "half_lose", "half lose": "half_lose",
    "függőben": "pending", "fuggoben": "pending", "pending": "pending", "open": "pending", "": "pending",
}

HEADER_ALIASES = {
    "date": ["dátum", "datum", "date", "idő", "ido"],
    "sport": ["sport"],
    "market": ["piac", "market", "típus", "tipus"],
    "selection": ["tipp", "selection", "esemény", "esemeny", "pick", "bet"],
    "stake": ["tét", "tet", "stake", "tétösszeg", "amount"],
    "odds": ["odds", "szorzó", "szorzo", "odd"],
    "result": ["eredmény", "eredmeny", "result", "status"],
    "bookmaker": ["fogadóiroda", "fogadoiroda", "bookmaker", "iroda", "book"],
    "note": ["jegyzet", "note", "megjegyzés", "megjegyzes", "comment"],
}


def _to_float(s):
    s = str(s or "").strip().replace(" ", "").replace("Ft", "").replace("€", "").replace("$", "").replace("£", "")
    s = s.replace(",", ".")
    return float(s)


def _parse_date_flexible(raw) -> datetime:
    raw = (raw or "").strip()
    if not raw:
        return datetime.now(timezone.utc)
    try:
        d = datetime.fromisoformat(raw)
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d
    except Exception:
        pass
    for fmt in ("%Y. %m. %d.", "%Y.%m.%d.", "%Y-%m-%d", "%Y.%m.%d", "%d/%m/%Y", "%m/%d/%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
        except Exception:
            continue
    return datetime.now(timezone.utc)


@api_router.post("/bets/import")
async def import_bets(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content = (await file.read()).decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(content, newline=""))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="Üres vagy érvénytelen CSV fájl")
    norm = {h: (h or "").strip().lower() for h in reader.fieldnames}

    def find(row, key):
        for h, low in norm.items():
            if low in HEADER_ALIASES[key]:
                return (row.get(h) or "").strip()
        return ""

    async with SessionLocal() as s:
        active = await ensure_bankrolls(s, user["id"])
        imported, errors = 0, 0
        for row in reader:
            try:
                stake = _to_float(find(row, "stake"))
                odds = _to_float(find(row, "odds"))
            except Exception:
                errors += 1
                continue
            result = RESULT_ALIASES.get(find(row, "result").lower(), "pending")
            s.add(Bet(public_id=f"bet_{uuid.uuid4().hex[:12]}", user_id=user["id"],
                      bankroll_id=active.id, bet_date=_parse_date_flexible(find(row, "date")),
                      sport=find(row, "sport") or "Egyéb",
                      market=find(row, "market") or "Meccs kimenetel",
                      selection=find(row, "selection"), stake=stake, odds=odds, units=None,
                      result=result, bookmaker=find(row, "bookmaker"), note=find(row, "note"),
                      profit=compute_profit(stake, odds, result)))
            imported += 1
            if imported % 500 == 0:
                await s.flush()
        await s.commit()
    return {"imported": imported, "errors": errors}


# ---------------- Analytics ----------------
def _parse_dt(s):
    try:
        d = datetime.fromisoformat(s)
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d
    except Exception:
        return None


async def _load_bets(s, user_db_id: int, bankroll_db_id: int, bankroll_public_id: str,
                     user_public_id: str, start_date=None, end_date=None,
                     newest_first=False, limit=5000) -> List[dict]:
    """Server-side filtered/sorted fetch; streams rows in chunks instead of one big list."""
    stmt = select(Bet).where(Bet.user_id == user_db_id, Bet.bankroll_id == bankroll_db_id)
    sd = _parse_dt(start_date) if start_date else None
    ed = _parse_dt(end_date) if end_date else None
    if sd:
        stmt = stmt.where(Bet.bet_date >= sd)
    if ed:
        stmt = stmt.where(Bet.bet_date <= ed)
    stmt = stmt.order_by(Bet.bet_date.desc() if newest_first else Bet.bet_date).limit(limit)
    out = []
    result = await s.stream_scalars(stmt.execution_options(yield_per=500))
    async for b in result:
        out.append(bet_dict(b, user_public_id, bankroll_public_id))
    return out


@api_router.get("/analytics")
async def analytics(user: dict = Depends(get_current_user),
                    start_date: Optional[str] = Query(None),
                    end_date: Optional[str] = Query(None)):
    async with SessionLocal() as s:
        active = await ensure_bankrolls(s, user["id"])
        bets = await _load_bets(s, user["id"], active.id, active.public_id, user["user_id"],
                                start_date, end_date)
        settings = bankroll_dict(active, user["user_id"])
        await s.commit()

    settled = [b for b in bets if b["result"] not in ("pending",)]

    total_staked = sum(b["stake"] for b in settled)
    total_profit = sum(b.get("profit", 0) for b in settled)
    wins = [b for b in settled if b["result"] in ("win", "half_win")]
    losses = [b for b in settled if b["result"] in ("lose", "half_lose")]
    decisive = [b for b in settled if b["result"] in ("win", "lose", "half_win", "half_lose")]

    roi = (total_profit / total_staked * 100) if total_staked else 0
    win_rate = (len(wins) / len(decisive) * 100) if decisive else 0
    yield_val = roi  # yield == profit / staked for flat context
    avg_odds = (sum(b["odds"] for b in settled) / len(settled)) if settled else 0
    starting = settings.get("starting_bankroll", 0) or 0
    current_bankroll = starting + total_profit

    # bankroll curve
    curve = []
    running = starting
    for b in sorted(settled, key=lambda x: x["date"]):
        running += b.get("profit", 0)
        curve.append({"date": b["date"], "bankroll": round(running, 2), "profit": round(running - starting, 2)})

    # streaks
    best_win = cur_win = best_lose = cur_lose = 0
    for b in sorted(decisive, key=lambda x: x["date"]):
        if b.get("profit", 0) > 0:
            cur_win += 1; cur_lose = 0
        else:
            cur_lose += 1; cur_win = 0
        best_win = max(best_win, cur_win)
        best_lose = max(best_lose, cur_lose)

    # breakdown by sport
    def breakdown(key):
        agg = {}
        for b in settled:
            k = b.get(key) or "Egyéb"
            a = agg.setdefault(k, {"name": k, "profit": 0, "staked": 0, "count": 0})
            a["profit"] += b.get("profit", 0)
            a["staked"] += b["stake"]
            a["count"] += 1
        for a in agg.values():
            a["roi"] = round(a["profit"] / a["staked"] * 100, 2) if a["staked"] else 0
            a["profit"] = round(a["profit"], 2)
        return sorted(agg.values(), key=lambda x: x["profit"], reverse=True)

    # profit timeline (daily aggregation)
    daily_profit = {}
    for b in sorted(settled, key=lambda x: x["date"]):
        day = (b.get("date") or "")[:10]
        if not day:
            continue
        daily_profit[day] = daily_profit.get(day, 0) + b.get("profit", 0)
    profit_timeline = [{"date": d, "profit": round(v, 2)} for d, v in daily_profit.items()]

    return {
        "kpis": {
            "total_bets": len(bets),
            "settled_bets": len(settled),
            "pending_bets": len(bets) - len(settled),
            "total_staked": round(total_staked, 2),
            "total_profit": round(total_profit, 2),
            "roi": round(roi, 2),
            "yield": round(yield_val, 2),
            "win_rate": round(win_rate, 2),
            "avg_odds": round(avg_odds, 2),
            "current_bankroll": round(current_bankroll, 2),
            "starting_bankroll": starting,
            "best_win_streak": best_win,
            "best_lose_streak": best_lose,
        },
        "bankroll_curve": curve,
        "profit_timeline": profit_timeline,
        "by_sport": breakdown("sport"),
        "by_market": breakdown("market"),
        "currency": settings.get("currency", "HUF"),
    }


@api_router.get("/limits/status")
async def limits_status(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = day_start - timedelta(days=now.weekday())
    async with SessionLocal() as s:
        active = await ensure_bankrolls(s, user["id"])
        settings = bankroll_dict(active, user["user_id"])

        async def staked_since(dt):
            total = (await s.execute(
                select(func.coalesce(func.sum(Bet.stake), 0)).where(
                    Bet.user_id == user["id"], Bet.bankroll_id == active.id,
                    Bet.bet_date >= dt))).scalar_one()
            return float(total or 0)

        daily = await staked_since(day_start)
        weekly = await staked_since(week_start)
        await s.commit()

    dl = settings.get("daily_limit", 0) or 0
    wl = settings.get("weekly_limit", 0) or 0
    daily_pct = round(daily / dl * 100, 1) if dl else 0
    weekly_pct = round(weekly / wl * 100, 1) if wl else 0
    return {
        "daily_staked": round(daily, 2), "daily_limit": dl, "daily_pct": daily_pct,
        "weekly_staked": round(weekly, 2), "weekly_limit": wl, "weekly_pct": weekly_pct,
        "daily_exceeded": bool(dl and daily > dl),
        "weekly_exceeded": bool(wl and weekly > wl),
        "daily_near": bool(dl and 80 <= daily_pct <= 100),
        "weekly_near": bool(wl and 80 <= weekly_pct <= 100),
        "currency": settings.get("currency", "HUF"),
    }


# ---------------- Export ----------------
@api_router.get("/export/csv")
async def export_csv(user: dict = Depends(get_current_user)):
    async with SessionLocal() as s:
        active = await ensure_bankrolls(s, user["id"])
        bets = await _load_bets(s, user["id"], active.id, active.public_id, user["user_id"],
                                newest_first=True)
        await s.commit()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Dátum", "Sport", "Piac", "Tipp", "Tét", "Odds", "Eredmény", "Profit", "Fogadóiroda", "Jegyzet"])
    for b in bets:
        writer.writerow([b.get("date", ""), b.get("sport", ""), b.get("market", ""), b.get("selection", ""),
                         b.get("stake", ""), b.get("odds", ""), b.get("result", ""),
                         b.get("profit", ""), b.get("bookmaker", ""), b.get("note", "")])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=fogadasok.csv"})


# ---------------- Cloud PDF Reports ----------------
def build_report_pdf(user_name, analytics_data, bets, currency) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    def ascii_hu(s):
        m = {"á": "a", "é": "e", "í": "i", "ó": "o", "ö": "o", "ő": "o", "ú": "u",
             "ü": "u", "ű": "u", "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ö": "O",
             "Ő": "O", "Ú": "U", "Ü": "U", "Ű": "U"}
        return "".join(m.get(c, c) for c in str(s))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm)
    styles = getSampleStyleSheet()
    title = ParagraphStyle("t", parent=styles["Title"], textColor=colors.HexColor("#0B0B0B"))
    elems = [Paragraph("Bet Tracker Pro - Jelentes", title),
             Paragraph(ascii_hu(f"Felhasznalo: {user_name} · {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"), styles["Normal"]),
             Spacer(1, 10 * mm)]
    k = analytics_data["kpis"]
    kpi_rows = [
        ["Nettó profit", f"{k['total_profit']} {currency}"],
        ["ROI", f"{k['roi']}%"],
        ["Yield", f"{k['yield']}%"],
        ["Talalati arany", f"{k['win_rate']}%"],
        ["Megtett tet", f"{k['total_staked']} {currency}"],
        ["Aktualis bankroll", f"{k['current_bankroll']} {currency}"],
        ["Fogadasok / lezart", f"{k['total_bets']} / {k['settled_bets']}"],
        ["Nyero / veszto sorozat", f"{k['best_win_streak']} / {k['best_lose_streak']}"],
    ]
    t = Table([["Mutato", "Ertek"]] + [[ascii_hu(a), ascii_hu(b)] for a, b in kpi_rows], colWidths=[70 * mm, 90 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#00C853")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#DDDDDD")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F4F4F4")]),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
    ]))
    elems += [t, Spacer(1, 10 * mm), Paragraph("Fogadasok", styles["Heading2"])]

    rows = [["Datum", "Sport", "Tipp", "Tet", "Odds", "Eredmeny", "Profit"]]
    res_hu = {"win": "Nyert", "lose": "Vesztett", "void": "Ervenytelen",
              "half_win": "Fel nyeres", "half_lose": "Fel vesztes", "pending": "Fuggoben"}
    for b in bets[:120]:
        d = b.get("date", "")[:10]
        rows.append([d, ascii_hu(b.get("sport", "")), ascii_hu((b.get("selection") or "")[:28]),
                     str(b.get("stake", "")), str(b.get("odds", "")),
                     res_hu.get(b.get("result"), b.get("result", "")), str(b.get("profit", ""))])
    bt = Table(rows, colWidths=[22 * mm, 24 * mm, 42 * mm, 20 * mm, 16 * mm, 22 * mm, 20 * mm], repeatRows=1)
    bt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111111")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E5E5E5")),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F7F7")]),
    ]))
    elems.append(bt)
    doc.build(elems)
    return buf.getvalue()


@api_router.post("/reports/pdf")
async def create_report(user: dict = Depends(get_current_user)):
    analytics_data = await analytics(user)
    async with SessionLocal() as s:
        active = await ensure_bankrolls(s, user["id"])
        currency = active.currency or "HUF"
        bets = await _load_bets(s, user["id"], active.id, active.public_id, user["user_id"],
                                newest_first=True, limit=200)
        pdf_bytes = build_report_pdf(user.get("name") or user.get("email"), analytics_data, bets, currency)
        ts = datetime.now(timezone.utc)
        rep = Report(public_id=f"rep_{uuid.uuid4().hex[:12]}", user_id=user["id"],
                     filename=f"jelentes_{ts.strftime('%Y%m%d_%H%M')}.pdf",
                     size=len(pdf_bytes), pdf_data=pdf_bytes, is_deleted=False)
        s.add(rep)
        await s.flush()
        payload = report_dict(rep, user["user_id"])
        await s.commit()
        return payload


@api_router.get("/reports")
async def list_reports(user: dict = Depends(get_current_user),
                       limit: int = Query(1000, ge=1, le=1000),
                       offset: int = Query(0, ge=0)):
    async with SessionLocal() as s:
        rows = (await s.execute(
            select(Report.public_id, Report.filename, Report.size, Report.is_deleted, Report.created_at)
            .where(Report.user_id == user["id"], Report.is_deleted.is_(False))
            .order_by(Report.created_at.desc(), Report.id.desc())
            .limit(limit).offset(offset))).all()
        return [{"report_id": r.public_id, "user_id": user["user_id"], "filename": r.filename,
                 "size": r.size, "is_deleted": r.is_deleted,
                 "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]


@api_router.get("/reports/{report_id}/download")
async def download_report(report_id: str, user: dict = Depends(get_current_user)):
    async with SessionLocal() as s:
        row = (await s.execute(
            select(Report.pdf_data, Report.filename).where(
                Report.public_id == report_id, Report.user_id == user["id"],
                Report.is_deleted.is_(False)))).first()
        if not row or not row.pdf_data:
            raise HTTPException(status_code=404, detail="Jelentés nem található")
        return Response(content=bytes(row.pdf_data), media_type="application/pdf",
                        headers={"Content-Disposition": f"attachment; filename={row.filename}"})


@api_router.delete("/reports/{report_id}")
async def delete_report(report_id: str, user: dict = Depends(get_current_user)):
    async with SessionLocal() as s:
        res = await s.execute(update(Report).where(
            Report.public_id == report_id, Report.user_id == user["id"]).values(is_deleted=True))
        await s.commit()
        if res.rowcount == 0:
            raise HTTPException(status_code=404, detail="Jelentés nem található")
        return {"ok": True}


@api_router.get("/")
async def root():
    return {"message": "Bet Tracker Pro API"}


app.include_router(api_router)

CORS_ORIGINS = [o.strip() for o in os.environ.get('CORS_ORIGINS', '').split(',') if o.strip() and o.strip() != '*']
if not CORS_ORIGINS:
    raise RuntimeError("CORS_ORIGINS environment variable is required (explicit origins only, '*' is not allowed)")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    if os.environ.get("RUN_MIGRATIONS_ON_STARTUP", "true").lower() == "true":
        import asyncio
        await asyncio.to_thread(run_migrations)
    # seed admin
    admin_email = os.environ.get("ADMIN_EMAIL")
    admin_password = os.environ.get("ADMIN_PASSWORD")
    if admin_email and admin_password:
        async with SessionLocal() as s:
            existing = (await s.execute(
                select(User).where(User.email == admin_email.lower()))).scalar_one_or_none()
            if not existing:
                admin = User(public_id=f"user_{uuid.uuid4().hex[:12]}", email=admin_email.lower(),
                             name="Admin", password_hash=hash_password(admin_password),
                             picture="", auth_provider="email")
                s.add(admin)
                await s.flush()
                await ensure_bankrolls(s, admin.id)
                await s.commit()


@app.on_event("shutdown")
async def shutdown():
    await engine.dispose()
