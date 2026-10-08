"""End-to-end backend tests for Bet Tracker Pro v4."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://odds-sync-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@bettracker.pro"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def new_user_session():
    s = requests.Session()
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    password = "Passw0rd!"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": password, "name": "Tester"})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["email"] == email
    return {"session": s, "email": email, "password": password, "user": data}


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return s


# ---------------- Auth ----------------
class TestAuth:
    def test_register_sets_cookie_and_me_works(self, new_user_session):
        s = new_user_session["session"]
        assert "access_token" in s.cookies.get_dict()
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == new_user_session["email"]

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_login_admin(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------------- Settings / Onboarding ----------------
class TestSettings:
    def test_new_user_not_onboarded(self, new_user_session):
        s = new_user_session["session"]
        r = s.get(f"{API}/settings")
        assert r.status_code == 200
        assert r.json().get("onboarded") is False

    def test_update_settings_persists(self, new_user_session):
        s = new_user_session["session"]
        payload = {"onboarded": True, "starting_bankroll": 200000, "currency": "HUF",
                   "daily_limit": 5000, "weekly_limit": 20000}
        r = s.put(f"{API}/settings", json=payload)
        assert r.status_code == 200
        r2 = s.get(f"{API}/settings")
        d = r2.json()
        assert d["onboarded"] is True
        assert d["starting_bankroll"] == 200000
        assert d["daily_limit"] == 5000


# ---------------- Bets CRUD + profit ----------------
class TestBets:
    def test_profit_win(self, new_user_session):
        s = new_user_session["session"]
        r = s.post(f"{API}/bets", json={"sport": "Foci", "selection": "A", "stake": 1000, "odds": 2.0, "result": "win"})
        assert r.status_code == 200
        d = r.json()
        assert d["profit"] == 1000.0
        new_user_session["bet_win_id"] = d["bet_id"]

    def test_profit_lose(self, new_user_session):
        s = new_user_session["session"]
        r = s.post(f"{API}/bets", json={"sport": "Foci", "selection": "B", "stake": 500, "odds": 3.0, "result": "lose"})
        assert r.status_code == 200
        assert r.json()["profit"] == -500.0

    def test_profit_half_win(self, new_user_session):
        s = new_user_session["session"]
        r = s.post(f"{API}/bets", json={"sport": "Tenisz", "selection": "C", "stake": 1000, "odds": 3.0, "result": "half_win"})
        assert r.status_code == 200
        assert r.json()["profit"] == 1000.0  # 1000*(3-1)/2

    def test_profit_half_lose(self, new_user_session):
        s = new_user_session["session"]
        r = s.post(f"{API}/bets", json={"sport": "Kosár", "selection": "D", "stake": 800, "odds": 1.9, "result": "half_lose"})
        assert r.status_code == 200
        assert r.json()["profit"] == -400.0

    def test_profit_void_pending(self, new_user_session):
        s = new_user_session["session"]
        for res in ("void", "pending"):
            r = s.post(f"{API}/bets", json={"sport": "Foci", "selection": res, "stake": 200, "odds": 2.0, "result": res})
            assert r.status_code == 200
            assert r.json()["profit"] == 0.0

    def test_list_bets(self, new_user_session):
        s = new_user_session["session"]
        r = s.get(f"{API}/bets")
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_update_bet_recomputes_profit(self, new_user_session):
        s = new_user_session["session"]
        bet_id = new_user_session["bet_win_id"]
        r = s.put(f"{API}/bets/{bet_id}", json={"sport": "Foci", "selection": "A", "stake": 1000, "odds": 2.0, "result": "lose"})
        assert r.status_code == 200
        assert r.json()["profit"] == -1000.0

    def test_delete_bet(self, new_user_session):
        s = new_user_session["session"]
        bet_id = new_user_session["bet_win_id"]
        r = s.delete(f"{API}/bets/{bet_id}")
        assert r.status_code == 200
        r2 = s.put(f"{API}/bets/{bet_id}", json={"sport": "Foci", "selection": "A", "stake": 1, "odds": 2, "result": "win"})
        assert r2.status_code == 404


# ---------------- Analytics / Limits / Export ----------------
class TestAnalyticsLimitsExport:
    def test_analytics(self, new_user_session):
        s = new_user_session["session"]
        r = s.get(f"{API}/analytics")
        assert r.status_code == 200
        d = r.json()
        assert "kpis" in d and "bankroll_curve" in d and "by_sport" in d and "by_market" in d
        k = d["kpis"]
        for key in ("roi", "yield", "win_rate", "total_profit", "current_bankroll",
                    "best_win_streak", "best_lose_streak", "total_bets"):
            assert key in k

    def test_limits_status(self, new_user_session):
        s = new_user_session["session"]
        r = s.get(f"{API}/limits/status")
        assert r.status_code == 200
        d = r.json()
        for key in ("daily_staked", "weekly_staked", "daily_exceeded", "weekly_exceeded"):
            assert key in d
        # user set daily_limit=5000 and staked > 5000 (1000+500+1000+800+200+200 = 3700 today) -> not exceeded
        # weekly likely same
        assert isinstance(d["daily_exceeded"], bool)

    def test_export_csv(self, new_user_session):
        s = new_user_session["session"]
        r = s.get(f"{API}/export/csv")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "Dátum" in r.text or "Datum" in r.text


# ---------------- CSV Import (new) ----------------
class TestCsvImport:
    def test_import_hungarian_csv(self, new_user_session):
        s = new_user_session["session"]
        csv_body = (
            "Dátum,Sport,Piac,Tipp,Tét,Odds,Eredmény,Fogadóiroda,Jegyzet\n"
            "2025-01-05,Labdarúgás,Meccs kimenetel,Arsenal,1000,2.10,Nyert,Bet365,ok\n"
            "2025.01.06.,Kosárlabda,Meccs kimenetel,Lakers,500,1.90,Vesztett,Tippmix,\n"
            "2025-01-07,Tenisz,Set,Djokovic,2000,1.50,Fél nyerés,Unibet,\n"
            "2025-01-08,Foci,Meccs,Chelsea,ABC,2.0,Nyert,Bet365,malformed-stake\n"
            "2025-01-09,Foci,Meccs,Void bet,300,1.80,Érvénytelen,Bet365,\n"
            "2025-01-10,Foci,Meccs,Open,400,2.5,,Bet365,blank-is-pending\n"
        )
        files = {"file": ("bets.csv", csv_body.encode("utf-8"), "text/csv")}
        r = s.post(f"{API}/bets/import", files=files)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["imported"] == 5, f"expected 5 valid rows, got {d}"
        assert d["errors"] == 1, f"expected 1 malformed row, got {d}"

        # verify persistence via GET /bets
        r2 = s.get(f"{API}/bets")
        assert r2.status_code == 200
        rows = r2.json()
        selections = {b["selection"]: b for b in rows}
        assert "Arsenal" in selections
        arsenal = selections["Arsenal"]
        assert arsenal["result"] == "win"
        assert arsenal["profit"] == 1100.0  # 1000*(2.10-1)
        assert selections["Lakers"]["result"] == "lose"
        assert selections["Lakers"]["profit"] == -500.0
        assert selections["Djokovic"]["result"] == "half_win"
        assert selections["Void bet"]["result"] == "void"
        assert selections["Open"]["result"] == "pending"

    def test_import_requires_auth(self):
        files = {"file": ("bets.csv", b"Datum,Sport\n", "text/csv")}
        r = requests.post(f"{API}/bets/import", files=files)
        assert r.status_code == 401


# ---------------- Analytics profit_timeline (new) ----------------
class TestProfitTimeline:
    def test_timeline_present_and_aggregated(self, new_user_session):
        s = new_user_session["session"]
        r = s.get(f"{API}/analytics")
        assert r.status_code == 200
        d = r.json()
        assert "profit_timeline" in d
        pt = d["profit_timeline"]
        assert isinstance(pt, list)
        # every entry {date, profit}
        for e in pt:
            assert "date" in e and "profit" in e
        # dates unique (aggregated per day)
        dates = [e["date"] for e in pt]
        assert len(dates) == len(set(dates))

    def test_timeline_respects_date_range(self, new_user_session):
        s = new_user_session["session"]
        # very narrow future window -> should be empty
        r = s.get(f"{API}/analytics",
                  params={"start_date": "2099-01-01T00:00:00+00:00",
                          "end_date": "2099-12-31T00:00:00+00:00"})
        assert r.status_code == 200
        assert r.json()["profit_timeline"] == []


# ---------------- Image bet recognition REMOVED ----------------
class TestBetFromImageRemoved:
    """POST /api/bets/from-image must no longer exist (feature removed in v4 iter 4)."""

    def test_from_image_endpoint_gone_unauth(self):
        r = requests.post(f"{API}/bets/from-image",
                          files={"file": ("s.png", b"fake", "image/png")})
        assert r.status_code in (404, 405), f"expected 404/405, got {r.status_code} {r.text[:200]}"
        assert r.status_code != 200

    def test_from_image_endpoint_gone_authed(self, new_user_session):
        s = new_user_session["session"]
        r = s.post(f"{API}/bets/from-image",
                   files={"file": ("s.png", b"fake", "image/png")})
        assert r.status_code in (404, 405)
        assert r.status_code != 200


# ---------------- CSV import CRLF + quoted field ----------------
class TestCsvCRLF:
    def test_import_crlf_with_quoted_field(self, new_user_session):
        s = new_user_session["session"]
        # CRLF line endings + a quoted "note" containing comma and newline
        csv_body = (
            "Dátum,Sport,Piac,Tipp,Tét,Odds,Eredmény,Fogadóiroda,Jegyzet\r\n"
            "2025-02-01,Foci,Meccs kimenetel,CRLFTeam,1500,1.85,Nyert,Bet365,\"comma, and\nnewline inside\"\r\n"
            "2025-02-02,Tenisz,Set,CRLFPlayer,700,2.20,Vesztett,Unibet,plain\r\n"
        )
        files = {"file": ("crlf.csv", csv_body.encode("utf-8"), "text/csv")}
        r = s.post(f"{API}/bets/import", files=files)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["imported"] == 2, d
        assert d["errors"] == 0
        rows = s.get(f"{API}/bets").json()
        sels = {b["selection"]: b for b in rows}
        assert "CRLFTeam" in sels and "CRLFPlayer" in sels
        assert sels["CRLFTeam"]["result"] == "win"


# ---------------- Reports (account-based, DB base64) ----------------
class TestReportsAccount:
    def test_full_report_lifecycle(self, new_user_session):
        s = new_user_session["session"]
        # Create
        r = s.post(f"{API}/reports/pdf")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("report_id", "filename", "size"):
            assert k in d, f"missing {k}: {d}"
        assert "pdf_base64" not in d, "create response must NOT include pdf_base64"
        assert d["size"] > 100
        rid = d["report_id"]
        new_user_session["report_id"] = rid

        # List (no pdf_base64)
        r2 = s.get(f"{API}/reports")
        assert r2.status_code == 200
        items = r2.json()
        assert any(x["report_id"] == rid for x in items)
        for x in items:
            assert "pdf_base64" not in x, "list must NOT expose pdf_base64"

        # Download returns actual PDF
        r3 = s.get(f"{API}/reports/{rid}/download")
        assert r3.status_code == 200
        assert r3.headers.get("content-type", "").startswith("application/pdf")
        assert r3.content[:4] == b"%PDF", f"not a PDF: {r3.content[:20]}"

        # Delete (soft)
        r4 = s.delete(f"{API}/reports/{rid}")
        assert r4.status_code == 200

        # Now gone from list
        r5 = s.get(f"{API}/reports")
        assert r5.status_code == 200
        assert not any(x["report_id"] == rid for x in r5.json())

        # Download returns 404
        r6 = s.get(f"{API}/reports/{rid}/download")
        assert r6.status_code == 404

    def test_reports_isolation_between_users(self, new_user_session):
        # User A creates a report
        sA = new_user_session["session"]
        rA = sA.post(f"{API}/reports/pdf")
        assert rA.status_code == 200
        rid = rA.json()["report_id"]

        # Register user B fresh
        sB = requests.Session()
        emailB = f"testb_{uuid.uuid4().hex[:8]}@example.com"
        reg = sB.post(f"{API}/auth/register", json={"email": emailB, "password": "Passw0rd!", "name": "B"})
        assert reg.status_code == 200

        # B lists own reports -> must NOT include A's
        lst = sB.get(f"{API}/reports")
        assert lst.status_code == 200
        assert not any(x["report_id"] == rid for x in lst.json())

        # B cannot download A's report
        dl = sB.get(f"{API}/reports/{rid}/download")
        assert dl.status_code == 404

        # B cannot delete A's report
        de = sB.delete(f"{API}/reports/{rid}")
        assert de.status_code == 404

        # Cleanup A's report
        sA.delete(f"{API}/reports/{rid}")


# ---------------- Auth isolation ----------------
class TestAuthIsolation:
    def test_user_only_sees_own_bets(self, new_user_session, admin_session):
        s = new_user_session["session"]
        r1 = s.get(f"{API}/bets")
        r2 = admin_session.get(f"{API}/bets")
        assert r1.status_code == 200 and r2.status_code == 200
        u_ids = {b["bet_id"] for b in r1.json()}
        a_ids = {b["bet_id"] for b in r2.json()}
        assert u_ids.isdisjoint(a_ids)
