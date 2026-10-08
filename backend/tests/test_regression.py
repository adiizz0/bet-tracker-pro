"""Regression tests for Bet Tracker Pro after Vercel npm config change."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://08cdf977-67b3-49dc-b1b7-f3fee1eb3432.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@bettracker.pro"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_session(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token")
    assert token, "No access_token in login response"
    session.headers.update({"Authorization": f"Bearer {token}"})
    return session


# Backend health
def test_health(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("message") == "Bet Tracker Pro API"


# Auth: login
def test_admin_login(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("email") == ADMIN_EMAIL
    assert d.get("access_token")


def test_login_invalid(session):
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
    assert r.status_code == 401


# Auth: /me
def test_auth_me(auth_session):
    r = auth_session.get(f"{API}/auth/me")
    assert r.status_code == 200
    assert r.json().get("email") == ADMIN_EMAIL


# Bankrolls
def test_bankrolls_list(auth_session):
    r = auth_session.get(f"{API}/bankrolls")
    assert r.status_code == 200
    body = r.json()
    # backend returns either a list or {"bankrolls": [...]}
    items = body if isinstance(body, list) else body.get("bankrolls")
    assert isinstance(items, list)


# Settings
def test_settings_get(auth_session):
    r = auth_session.get(f"{API}/settings")
    assert r.status_code == 200
    assert isinstance(r.json(), dict)


# Unauthenticated protection
def test_settings_requires_auth():
    r = requests.get(f"{API}/settings")
    assert r.status_code in (401, 403)
