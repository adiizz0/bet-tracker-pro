"""Regression tests: JWT via Authorization: Bearer header, no cookies.

Covers the fix for cross-origin/HTTP environments (Codespaces) where the
httpOnly access_token cookie is dropped. Backend must accept Authorization:
Bearer <access_token> both from /auth/register and /auth/login response bodies.
"""
import os
import uuid
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@bettracker.pro"
ADMIN_PASSWORD = "admin123"


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


class TestRegisterReturnsToken:
    def test_register_returns_token_in_body(self):
        email = f"bearer_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "Passw0rd!", "name": "Bearer"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "access_token" in body and isinstance(body["access_token"], str)
        assert len(body["access_token"]) > 50
        # cleanup pointer for later tests
        TestRegisterReturnsToken.token = body["access_token"]
        TestRegisterReturnsToken.email = email


class TestBearerNoCookies:
    """Use requests.get/put with only Authorization header — NO Session (=no cookies)."""

    def test_login_returns_token(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        assert "access_token" in r.json()
        TestBearerNoCookies.admin_token = r.json()["access_token"]

    def test_me_with_bearer_only(self):
        r = requests.get(f"{API}/auth/me", headers=_bearer(TestBearerNoCookies.admin_token))
        assert r.status_code == 200, r.text
        assert r.json()["email"] == ADMIN_EMAIL

    def test_me_missing_bearer(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_invalid_bearer(self):
        r = requests.get(f"{API}/auth/me", headers=_bearer("not.a.jwt"))
        assert r.status_code == 401

    def test_put_settings_with_bearer_only(self):
        """PUT /settings with Bearer header only should succeed (onboarding flow fix)."""
        # Fresh user (bearer only, no session)
        email = f"onb_{uuid.uuid4().hex[:8]}@example.com"
        reg = requests.post(f"{API}/auth/register",
                            json={"email": email, "password": "Passw0rd!", "name": "Onb"})
        assert reg.status_code == 200
        token = reg.json()["access_token"]

        payload = {"starting_bankroll": 150000, "currency": "HUF",
                   "unit_size": 1500, "profit_goal": 30000,
                   "daily_limit": 5000, "weekly_limit": 25000, "onboarded": True}
        r = requests.put(f"{API}/settings", json=payload, headers=_bearer(token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["onboarded"] is True
        assert d["starting_bankroll"] == 150000

        # Verify persistence via GET with bearer only
        r2 = requests.get(f"{API}/settings", headers=_bearer(token))
        assert r2.status_code == 200
        assert r2.json()["onboarded"] is True
        assert r2.json()["starting_bankroll"] == 150000

    def test_bets_crud_with_bearer_only(self):
        email = f"betsb_{uuid.uuid4().hex[:8]}@example.com"
        reg = requests.post(f"{API}/auth/register",
                            json={"email": email, "password": "Passw0rd!", "name": "B"})
        token = reg.json()["access_token"]

        # Create
        c = requests.post(f"{API}/bets",
                          json={"sport": "Foci", "selection": "X", "stake": 500,
                                "odds": 2.0, "result": "win"},
                          headers=_bearer(token))
        assert c.status_code == 200, c.text
        bet_id = c.json()["bet_id"]
        assert c.json()["profit"] == 500.0

        # Read
        lst = requests.get(f"{API}/bets", headers=_bearer(token))
        assert lst.status_code == 200
        assert any(b["bet_id"] == bet_id for b in lst.json())

        # Update
        u = requests.put(f"{API}/bets/{bet_id}",
                        json={"sport": "Foci", "selection": "X", "stake": 500,
                              "odds": 2.0, "result": "lose"},
                        headers=_bearer(token))
        assert u.status_code == 200
        assert u.json()["profit"] == -500.0

        # Delete
        d = requests.delete(f"{API}/bets/{bet_id}", headers=_bearer(token))
        assert d.status_code == 200


class TestSessionPersistsAcrossRequests:
    """Simulates a browser reload: use only localStorage-style token, no cookies."""

    def test_reload_persists_via_bearer(self):
        email = f"reload_{uuid.uuid4().hex[:8]}@example.com"
        reg = requests.post(f"{API}/auth/register",
                            json={"email": email, "password": "Passw0rd!", "name": "R"})
        token = reg.json()["access_token"]

        # simulate several independent requests (new socket, no cookies)
        for _ in range(3):
            me = requests.get(f"{API}/auth/me", headers=_bearer(token))
            assert me.status_code == 200
            assert me.json()["email"] == email
