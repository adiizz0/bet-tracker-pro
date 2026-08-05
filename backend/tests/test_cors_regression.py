"""CORS regression tests after Firebase Hosting domain support was added."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://odds-sync-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
LOCAL = "http://localhost:8001/api"  # for CORS header checks direct against backend

ADMIN_EMAIL = "admin@bettracker.pro"
ADMIN_PASSWORD = "admin123"


# ---------------- Auth Regression ----------------
class TestAuthRegression:
    def test_login_success_sets_cookie(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        assert "access_token" in s.cookies.get_dict()
        data = r.json()
        assert data["email"] == ADMIN_EMAIL

    def test_me_with_cookie(self):
        s = requests.Session()
        s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_wrong_password_401(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "bad"})
        assert r.status_code == 401

    def test_me_unauth_401(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------------- Core Endpoint Regression ----------------
class TestCoreEndpoints:
    @pytest.fixture(scope="class")
    def admin_sess(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        return s

    def test_bets(self, admin_sess):
        r = admin_sess.get(f"{API}/bets")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_analytics_has_profit_timeline(self, admin_sess):
        r = admin_sess.get(f"{API}/analytics")
        assert r.status_code == 200
        j = r.json()
        assert "kpis" in j
        assert "profit_timeline" in j
        assert isinstance(j["profit_timeline"], list)

    def test_settings(self, admin_sess):
        r = admin_sess.get(f"{API}/settings")
        assert r.status_code == 200

    def test_limits_status(self, admin_sess):
        r = admin_sess.get(f"{API}/limits/status")
        assert r.status_code == 200
        j = r.json()
        assert "daily_staked" in j and "weekly_staked" in j


# ---------------- CORS ----------------
def _preflight(url, origin):
    return requests.options(url, headers={
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    }, timeout=15)


class TestCORS:
    """CORS preflight tests hit local backend to inspect raw headers
    (ingress can strip CORS headers on some routes)."""

    def test_firebase_web_app_allowed(self):
        origin = "https://myproj.web.app"
        r = _preflight(f"{LOCAL}/auth/login", origin)
        assert r.status_code in (200, 204), r.text
        assert r.headers.get("access-control-allow-origin") == origin
        assert r.headers.get("access-control-allow-credentials", "").lower() == "true"

    def test_firebase_subdomain_firebaseapp_allowed(self):
        origin = "https://sub.myproj.firebaseapp.com"
        r = _preflight(f"{LOCAL}/auth/login", origin)
        assert r.status_code in (200, 204)
        assert r.headers.get("access-control-allow-origin") == origin
        assert r.headers.get("access-control-allow-credentials", "").lower() == "true"

    def test_preview_origin_allowed(self):
        origin = "https://odds-sync-3.preview.emergentagent.com"
        r = _preflight(f"{LOCAL}/auth/login", origin)
        assert r.status_code in (200, 204)
        assert r.headers.get("access-control-allow-origin") == origin

    def test_localhost_origin_allowed(self):
        origin = "http://localhost:3000"
        r = _preflight(f"{LOCAL}/auth/login", origin)
        assert r.status_code in (200, 204)
        assert r.headers.get("access-control-allow-origin") == origin

    def test_disallowed_origin_rejected(self):
        origin = "https://evil.example.com"
        r = _preflight(f"{LOCAL}/auth/login", origin)
        # Starlette returns 400 for disallowed preflight; either way ACAO must not echo origin
        acao = r.headers.get("access-control-allow-origin")
        assert acao != origin, f"Evil origin should not be reflected, got {acao}"

    def test_random_web_app_subdomain_allowed(self):
        origin = "https://another-app-123.web.app"
        r = _preflight(f"{LOCAL}/auth/login", origin)
        assert r.status_code in (200, 204)
        assert r.headers.get("access-control-allow-origin") == origin

    def test_netlify_app_allowed(self):
        origin = "https://mysite.netlify.app"
        r = _preflight(f"{LOCAL}/auth/login", origin)
        assert r.status_code in (200, 204), r.text
        assert r.headers.get("access-control-allow-origin") == origin
        assert r.headers.get("access-control-allow-credentials", "").lower() == "true"

    def test_netlify_subdomain_allowed(self):
        origin = "https://branch--mysite.netlify.app"
        r = _preflight(f"{LOCAL}/auth/login", origin)
        assert r.status_code in (200, 204)
        # regex uses [a-z0-9-]; '--' allowed
        assert r.headers.get("access-control-allow-origin") == origin
