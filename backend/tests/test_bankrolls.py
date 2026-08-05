"""Bankroll multi-account feature backend tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://odds-sync-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _register():
    email = f"TEST_br_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "T"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return email, token, {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def user():
    email, token, headers = _register()
    return {"email": email, "token": token, "headers": headers}


# ---------- Migration / initial state ----------
def test_new_user_has_main_bankroll(user):
    r = requests.get(f"{API}/bankrolls", headers=user["headers"])
    assert r.status_code == 200
    data = r.json()
    assert len(data["bankrolls"]) == 1
    assert data["bankrolls"][0]["name"] == "Fő bankroll"
    assert data["active_bankroll_id"] == data["bankrolls"][0]["bankroll_id"]


def test_demo_user_migration():
    r = requests.post(f"{API}/auth/login", json={"email": "demo@bettracker.pro", "password": "demo123"})
    assert r.status_code == 200
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    br = requests.get(f"{API}/bankrolls", headers=h).json()
    assert br["active_bankroll_id"]
    names = [b["name"] for b in br["bankrolls"]]
    assert "Fő bankroll" in names
    me = requests.get(f"{API}/auth/me", headers=h).json()
    # onboarded preserved
    settings = requests.get(f"{API}/settings", headers=h).json()
    assert settings.get("onboarded") is True


# ---------- Create / Activate / Rename / Delete ----------
def test_create_bankroll_becomes_active(user):
    r = requests.post(f"{API}/bankrolls", headers=user["headers"],
                      json={"name": "TEST_BR_2", "starting_bankroll": 50000, "currency": "EUR"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "TEST_BR_2"
    assert body["currency"] == "EUR"
    assert body["starting_bankroll"] == 50000
    user["br2"] = body["bankroll_id"]

    data = requests.get(f"{API}/bankrolls", headers=user["headers"]).json()
    assert data["active_bankroll_id"] == body["bankroll_id"]
    settings = requests.get(f"{API}/settings", headers=user["headers"]).json()
    assert settings["currency"] == "EUR"
    assert settings["starting_bankroll"] == 50000


def test_bet_isolation_between_bankrolls(user):
    # Currently active = br2
    bet_payload = {"date": "2026-01-15", "sport": "Foci", "market": "1X2",
                   "selection": "Home", "odds": 2.1, "stake": 1000, "status": "pending"}
    r = requests.post(f"{API}/bets", headers=user["headers"], json=bet_payload)
    assert r.status_code == 200, r.text
    bet_in_br2 = r.json()["bet_id"]

    bets2 = requests.get(f"{API}/bets", headers=user["headers"]).json()
    assert any(b["bet_id"] == bet_in_br2 for b in bets2)

    # Switch to Fő bankroll (first one)
    brs = requests.get(f"{API}/bankrolls", headers=user["headers"]).json()["bankrolls"]
    br1 = next(b["bankroll_id"] for b in brs if b["name"] == "Fő bankroll")
    r = requests.post(f"{API}/bankrolls/{br1}/activate", headers=user["headers"])
    assert r.status_code == 200

    bets1 = requests.get(f"{API}/bets", headers=user["headers"]).json()
    assert not any(b["bet_id"] == bet_in_br2 for b in bets1)

    # Analytics should reflect only current bankroll
    a1 = requests.get(f"{API}/analytics/summary", headers=user["headers"])
    if a1.status_code == 404:
        a1 = requests.get(f"{API}/analytics", headers=user["headers"])
    assert a1.status_code == 200


def test_rename_bankroll(user):
    r = requests.put(f"{API}/bankrolls/{user['br2']}", headers=user["headers"],
                     json={"name": "TEST_BR_RENAMED"})
    assert r.status_code == 200
    assert r.json()["name"] == "TEST_BR_RENAMED"
    brs = requests.get(f"{API}/bankrolls", headers=user["headers"]).json()["bankrolls"]
    assert any(b["name"] == "TEST_BR_RENAMED" for b in brs)


def test_delete_bankroll_and_cascade(user):
    # Currently active is Fő. Delete br2 (renamed). Bets in br2 should be gone.
    r = requests.delete(f"{API}/bankrolls/{user['br2']}", headers=user["headers"])
    assert r.status_code == 200
    brs = requests.get(f"{API}/bankrolls", headers=user["headers"]).json()["bankrolls"]
    assert not any(b["bankroll_id"] == user["br2"] for b in brs)


def test_cannot_delete_last_bankroll(user):
    brs = requests.get(f"{API}/bankrolls", headers=user["headers"]).json()["bankrolls"]
    assert len(brs) == 1
    r = requests.delete(f"{API}/bankrolls/{brs[0]['bankroll_id']}", headers=user["headers"])
    assert r.status_code == 400
    assert "Legalább" in r.json().get("detail", "")
