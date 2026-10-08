"""Iteration 6: Auth hardening + Google OAuth gating + env-var robustness tests."""
import os
import sys
import uuid
import subprocess
import pytest
import requests

from dotenv import load_dotenv
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@bettracker.pro"
ADMIN_PASSWORD = "admin123"


# ---------------- Env-var robustness (regression test for production 500) ----------------
def test_backend_module_imports_without_env_vars():
    """Verify server.py imports even when DB_NAME/MONGO_URL/JWT_SECRET are unset."""
    code = (
        "import sys, os;"
        "sys.path.insert(0, '/app/backend');"
        "import server;"
        "print('OK', server.DB_NAME, bool(server.JWT_SECRET))"
    )
    env = {"PATH": os.environ.get("PATH", "")}  # strip all app env vars
    result = subprocess.run(
        [sys.executable, "-c", code], capture_output=True, text=True, env=env, timeout=30
    )
    assert result.returncode == 0, f"Import failed: STDOUT={result.stdout} STDERR={result.stderr}"
    assert "OK" in result.stdout


# ---------------- Google OAuth gating ----------------
class TestGoogleOAuth:
    def test_google_config_disabled_locally(self):
        r = requests.get(f"{API}/auth/google/config")
        assert r.status_code == 200
        data = r.json()
        assert "enabled" in data
        assert data["enabled"] is False, f"Expected disabled locally, got {data}"

    def test_google_login_returns_503_when_disabled(self):
        r = requests.get(f"{API}/auth/google/login", allow_redirects=False)
        assert r.status_code == 503, f"Expected 503, got {r.status_code}: {r.text}"


# ---------------- Email auth core flows ----------------
class TestEmailAuth:
    def test_register_flow(self):
        email = f"test_iter6_{uuid.uuid4().hex[:8]}@example.com"
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "Passw0rd!", "name": "Iter6"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == email
        assert "access_token" in data
        # cookie set
        assert "access_token" in s.cookies.get_dict()

        # /auth/me with cookie
        r2 = s.get(f"{API}/auth/me")
        assert r2.status_code == 200
        assert r2.json()["email"] == email

        # default bankroll(s) created
        r3 = s.get(f"{API}/bankrolls")
        assert r3.status_code == 200
        payload = r3.json()
        brs = payload["bankrolls"] if isinstance(payload, dict) else payload
        assert len(brs) >= 1

        # bearer token also works
        token = data["access_token"]
        r4 = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r4.status_code == 200

        # logout clears
        r5 = s.post(f"{API}/auth/logout")
        assert r5.status_code == 200
        assert r5.json().get("ok") is True

        # after logout /me without token should be 401
        r6 = requests.get(f"{API}/auth/me")
        assert r6.status_code == 401

    def test_admin_login(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["email"] == ADMIN_EMAIL

        # protected route with bearer
        token = data["access_token"]
        r2 = requests.get(f"{API}/bankrolls", headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 200

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong_pw_xxx"})
        assert r.status_code == 401


# ---------------- Protected route gating ----------------
class TestProtectedRoutes:
    @pytest.mark.parametrize("path", ["/bankrolls", "/settings", "/bets"])
    def test_no_auth_returns_401(self, path):
        r = requests.get(f"{API}{path}")
        assert r.status_code == 401, f"{path} returned {r.status_code}"
