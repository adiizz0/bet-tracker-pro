import io
import json
import os
import sys
import time

import requests

API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
ok = []
fail = []


def check(name, cond, extra=""):
    (ok if cond else fail).append(name)
    print(("PASS " if cond else "FAIL ") + name + (f" :: {extra}" if not cond and extra else ""))


ts = int(time.time())
email_a = f"pg_a_{ts}@example.com"
email_b = f"pg_b_{ts}@example.com"

# 1-3 register
r = requests.post(f"{API}/auth/register", json={"email": email_a, "password": "Passw0rd!123", "name": "A"})
check("register", r.status_code == 200 and "access_token" in r.json(), r.text[:200])
tok_a = r.json()["access_token"]
ha = {"Authorization": f"Bearer {tok_a}"}

r = requests.post(f"{API}/auth/register", json={"email": email_b, "password": "Passw0rd!123", "name": "B"})
tok_b = r.json()["access_token"]
hb = {"Authorization": f"Bearer {tok_b}"}

# 4 login
r = requests.post(f"{API}/auth/login", json={"email": email_a, "password": "Passw0rd!123"})
check("login", r.status_code == 200 and r.json().get("user_id", "").startswith("user_"), r.text[:200])

# 5-6 jwt + /me
r = requests.get(f"{API}/auth/me", headers=ha)
check("jwt + /me", r.status_code == 200 and r.json()["email"] == email_a, r.text[:200])
check("jwt invalid rejected", requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer bad"}).status_code == 401)

# 7 settings/bankroll auto + create
r = requests.get(f"{API}/settings", headers=ha)
check("settings autocreate", r.status_code == 200 and r.json()["active_bankroll_id"].startswith("br_"), r.text[:200])
r = requests.post(f"{API}/bankrolls", json={"name": "Teszt BR", "starting_bankroll": 50000, "currency": "HUF"}, headers=ha)
check("bankroll create", r.status_code == 200 and r.json()["bankroll_id"].startswith("br_"), r.text[:200])
br2 = r.json()["bankroll_id"]
r = requests.get(f"{API}/bankrolls", headers=ha)
check("bankroll list", r.status_code == 200 and len(r.json()["bankrolls"]) == 2, r.text[:200])
r = requests.put(f"{API}/settings", json={"starting_bankroll": 100000, "unit_size": 1000, "daily_limit": 10000,
                                          "weekly_limit": 50000, "onboarded": True}, headers=ha)
check("settings update", r.status_code == 200 and r.json()["onboarded"] is True, r.text[:200])

# 8 bets create
bet_ids = []
for i, (stake, odds, res) in enumerate([(1000, 2.0, "win"), (500, 3.0, "lose"), (800, 1.5, "pending")]):
    r = requests.post(f"{API}/bets", json={"sport": "Foci", "selection": f"Pick{i}", "stake": stake,
                                           "odds": odds, "result": res}, headers=ha)
    if r.status_code == 200:
        bet_ids.append(r.json()["bet_id"])
check("bet create x3", len(bet_ids) == 3)
r = requests.get(f"{API}/bets", headers=ha)
check("bet list", r.status_code == 200 and len(r.json()) == 3, r.text[:200])
first = r.json()[0]
check("bet profit computed", any(b["profit"] == 1000.0 for b in r.json()), json.dumps(r.json())[:300])

# 9 update/delete
r = requests.put(f"{API}/bets/{bet_ids[0]}", json={"sport": "Tenisz", "selection": "Mod", "stake": 1000,
                                                   "odds": 2.0, "result": "lose"}, headers=ha)
check("bet update", r.status_code == 200 and r.json()["profit"] == -1000.0 and r.json()["sport"] == "Tenisz", r.text[:200])
r = requests.delete(f"{API}/bets/{bet_ids[2]}", headers=ha)
check("bet delete", r.status_code == 200, r.text[:200])
check("bet delete 404 again", requests.delete(f"{API}/bets/{bet_ids[2]}", headers=ha).status_code == 404)

# 10 analytics + limits
r = requests.get(f"{API}/analytics", headers=ha)
d = r.json()
check("analytics", r.status_code == 200 and d["kpis"]["total_bets"] == 2 and d["kpis"]["settled_bets"] == 2, r.text[:300])
check("analytics curve", len(d["bankroll_curve"]) == 2 and len(d["by_sport"]) >= 1)
r = requests.get(f"{API}/limits/status", headers=ha)
check("limits status", r.status_code == 200 and r.json()["daily_staked"] == 1500.0, r.text[:200])

# 11 pagination
r1 = requests.get(f"{API}/bets?limit=1&offset=0", headers=ha)
r2 = requests.get(f"{API}/bets?limit=1&offset=1", headers=ha)
check("pagination server-side", len(r1.json()) == 1 and len(r2.json()) == 1 and r1.json()[0]["bet_id"] != r2.json()[0]["bet_id"],
      f"{r1.text[:120]} | {r2.text[:120]}")

# 12 user isolation
check("isolation: B sees no A bets", requests.get(f"{API}/bets", headers=hb).json() == [])
check("isolation: B cannot update A bet", requests.put(f"{API}/bets/{bet_ids[1]}", json={"sport": "X", "stake": 1, "odds": 2, "result": "win"}, headers=hb).status_code == 404)
check("isolation: B cannot delete A bankroll", requests.delete(f"{API}/bankrolls/{br2}", headers=hb).status_code == 404)
check("unauth blocked", requests.get(f"{API}/bets").status_code == 401)

# 13 CSV import/export
csv_data = ("Dátum,Sport,Piac,Tipp,Tét,Odds,Eredmény,Fogadóiroda,Jegyzet\n"
            "2026-01-05,Kosár,Meccs kimenetel,Lakers,2 000 Ft,1,85,Nyert,Bet365,teszt\n"
            "2026.01.06.,Foci,Meccs kimenetel,Arsenal,1000,2.5,Vesztett,Tipico,\n")
r = requests.post(f"{API}/bets/import", files={"file": ("b.csv", csv_data.encode("utf-8"), "text/csv")}, headers=ha)
check("csv import", r.status_code == 200 and r.json()["imported"] == 2, r.text[:200])
r = requests.get(f"{API}/export/csv", headers=ha)
check("csv export", r.status_code == 200 and "Dátum" in r.text and "Lakers" in r.text, r.text[:200])

# 14 PDF report
r = requests.post(f"{API}/reports/pdf", headers=ha)
check("pdf create", r.status_code == 200 and r.json()["size"] > 1000, r.text[:200])
rep_id = r.json().get("report_id")
r = requests.get(f"{API}/reports", headers=ha)
check("pdf list", r.status_code == 200 and len(r.json()) == 1, r.text[:200])
r = requests.get(f"{API}/reports/{rep_id}/download", headers=ha)
check("pdf download", r.status_code == 200 and r.content[:4] == b"%PDF", str(r.status_code))
check("pdf isolation", requests.get(f"{API}/reports/{rep_id}/download", headers=hb).status_code == 404)
check("pdf delete", requests.delete(f"{API}/reports/{rep_id}", headers=ha).status_code == 200)

# bankroll switch + cascade delete
r = requests.post(f"{API}/bankrolls/{br2}/activate", headers=ha)
check("bankroll activate", r.status_code == 200 and r.json()["active_bankroll_id"] == br2, r.text[:200])
check("bets scoped to active bankroll", len(requests.get(f"{API}/bets", headers=ha).json()) == 4)
r = requests.delete(f"{API}/bankrolls/{br2}", headers=ha)
check("bankroll delete", r.status_code == 200, r.text[:200])
check("cascade: bets of deleted bankroll gone", requests.get(f"{API}/bets", headers=ha).json() == [])

# logout
check("logout", requests.post(f"{API}/auth/logout", headers=ha).status_code == 200)

print(f"\n=== {len(ok)} passed, {len(fail)} failed ===")
if fail:
    print("FAILED:", fail)
    sys.exit(1)
