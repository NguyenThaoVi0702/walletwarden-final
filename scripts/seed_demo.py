"""Create a demo account with two months of realistic data.

Runs against a running backend through the public API (same path as the app), so it works on
any machine and any database:

    cd backend
    uv run python ../scripts/seed_demo.py                       # http://127.0.0.1:8000
    uv run python ../scripts/seed_demo.py --base-url https://xxxx.trycloudflare.com
    uv run python ../scripts/seed_demo.py --reset               # delete this account's data first

Account: demo@walletwarden.vn / matkhau123 (change with --email/--password).
Roast Mode is switched off while seeding (so ~60 transactions do not queue ~60 roasts) and
switched back on, tone "savage", at the end.
"""

import argparse
import json
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta

# (day of month, kind, amount, category, note). Day <= today is enforced for the current month.
LAST_MONTH = [
    (1, "income", 15_000_000, "Lương", "Lương tháng"),
    (1, "expense", 3_500_000, "Nhà ở", "Tiền nhà"),
    (2, "expense", 45_000, "Ăn uống", "Phở bò"),
    (3, "expense", 650_000, "Hóa đơn", "Điện nước"),
    (4, "expense", 35_000, "Di chuyển", "Grab đi làm"),
    (5, "expense", 420_000, "Mua sắm", "Áo thun"),
    (7, "expense", 120_000, "Ăn uống", "Lẩu với bạn"),
    (9, "expense", 250_000, "Giải trí", "Xem phim"),
    (11, "expense", 60_000, "Di chuyển", "Đổ xăng"),
    (12, "expense", 300_000, "Sức khỏe", "Thuốc cảm"),
    (14, "expense", 55_000, "Ăn uống", "Cơm văn phòng"),
    (15, "income", 1_000_000, "Thưởng", "Thưởng dự án"),
    (17, "expense", 890_000, "Giáo dục", "Khoá học online"),
    (19, "expense", 80_000, "Ăn uống", "Bún chả"),
    (21, "expense", 1_200_000, "Mua sắm", "Giày chạy bộ"),
    (23, "expense", 60_000, "Di chuyển", "Đổ xăng"),
    (25, "expense", 150_000, "Giải trí", "Karaoke"),
    (27, "expense", 95_000, "Ăn uống", "Pizza"),
    (28, "expense", 200_000, "Khác", "Quà sinh nhật"),
]
THIS_MONTH = [
    (1, "income", 15_000_000, "Lương", "Lương tháng"),
    (1, "expense", 3_500_000, "Nhà ở", "Tiền nhà"),
    (1, "expense", 35_000, "Ăn uống", "Cà phê sáng"),
    (2, "expense", 50_000, "Ăn uống", "Bánh cuốn"),
    (2, "expense", 35_000, "Di chuyển", "Grab đi làm"),
    (3, "expense", 680_000, "Hóa đơn", "Điện nước"),
    (3, "expense", 45_000, "Ăn uống", "Phở bò"),
    (4, "expense", 1_850_000, "Mua sắm", "Tai nghe"),
    (4, "expense", 60_000, "Di chuyển", "Đổ xăng"),
    (5, "expense", 120_000, "Ăn uống", "Lẩu với bạn"),
    (5, "expense", 350_000, "Giải trí", "Vé concert"),
    (6, "expense", 40_000, "Ăn uống", "Trà sữa"),
    (6, "expense", 40_000, "Ăn uống", "Trà sữa"),
    (7, "expense", 250_000, "Sức khỏe", "Khám răng"),
    (7, "expense", 55_000, "Ăn uống", "Cơm văn phòng"),
    (8, "expense", 900_000, "Giải trí", "Đua xe gokart"),
    (8, "expense", 60_000, "Di chuyển", "Đổ xăng"),
    (9, "expense", 45_000, "Ăn uống", "Bún bò"),
    (9, "expense", 30_000, "Ăn uống", "Bánh mì"),
    (10, "expense", 520_000, "Mua sắm", "Sách + văn phòng phẩm"),
    (11, "expense", 65_000, "Ăn uống", "Cơm tấm"),
    (12, "expense", 1_200_000, "Giáo dục", "Học phí tiếng Anh"),
    (13, "expense", 35_000, "Di chuyển", "Grab"),
    (14, "expense", 80_000, "Ăn uống", "Bún chả"),
    (15, "income", 2_000_000, "Thu nhập khác", "Freelance"),
    (16, "expense", 300_000, "Giải trí", "Bowling"),
    (18, "expense", 95_000, "Ăn uống", "Pizza"),
    (20, "expense", 60_000, "Di chuyển", "Đổ xăng"),
    (22, "expense", 700_000, "Mua sắm", "Áo khoác"),
    (24, "expense", 150_000, "Ăn uống", "Lẩu nướng"),
    (26, "expense", 200_000, "Khác", "Quà"),
    (28, "expense", 55_000, "Ăn uống", "Cơm văn phòng"),
]
BUDGET_TOTAL = 9_000_000
BUDGETS = {
    "Ăn uống": 1_500_000,
    "Di chuyển": 400_000,
    "Mua sắm": 2_000_000,
    "Giải trí": 1_200_000,
}


class Api:
    def __init__(self, base_url: str) -> None:
        self.base = base_url.rstrip("/")
        self.token: str | None = None

    def call(self, method: str, path: str, body: object = None) -> object:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(self.base + path, data, headers, method=method)
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read()
            return json.loads(raw) if raw else None


def month_of(day: date) -> str:
    return day.strftime("%Y-%m")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--email", default="demo@walletwarden.vn")
    parser.add_argument("--password", default="matkhau123")
    parser.add_argument("--name", default="Demo")
    parser.add_argument("--reset", action="store_true", help="delete existing transactions first")
    args = parser.parse_args()
    api = Api(args.base_url)

    try:
        api.call("GET", "/api/health")
    except (urllib.error.URLError, OSError):
        print(f"Backend is not running at {args.base_url}. Start it first (see README).")
        return 1

    credentials = {"email": args.email, "password": args.password}
    try:
        session = api.call("POST", "/api/auth/register", {**credentials, "display_name": args.name})
        print(f"Created {args.email}")
    except urllib.error.HTTPError as error:
        if error.code != 409:
            raise
        session = api.call("POST", "/api/auth/login", credentials)
        print(f"{args.email} already exists, logged in")
    api.token = session["access_token"]  # type: ignore[index]

    today = date.today()
    first_this = today.replace(day=1)
    first_last = (first_this - timedelta(days=1)).replace(day=1)

    existing = []
    for first in (first_last, first_this):
        existing += api.call("GET", f"/api/transactions?month={month_of(first)}")  # type: ignore[operator]
    if existing and not args.reset:
        print(f"Account already has {len(existing)} transactions; use --reset to seed again.")
        return 0
    for tx in existing:
        api.call("DELETE", f"/api/transactions/{tx['id']}")

    categories = {c["name"]: c["id"] for c in api.call("GET", "/api/categories")}  # type: ignore[union-attr]
    api.call("PATCH", "/api/me/settings", {"roast_enabled": False})

    count = 0
    for first, rows in ((first_last, LAST_MONTH), (first_this, THIS_MONTH)):
        for day, kind, amount, category, note in rows:
            when = first + timedelta(days=day - 1)
            if when > today or when.month != first.month:
                continue
            api.call(
                "POST",
                "/api/transactions",
                {
                    "kind": kind,
                    "amount": amount,
                    "category_id": categories[category],
                    "date": when.isoformat(),
                    "note": note,
                },
            )
            count += 1
        api.call(
            "PUT",
            "/api/budgets",
            {
                "month": month_of(first),
                "total": BUDGET_TOTAL,
                "categories": [
                    {"category_id": categories[name], "limit": limit}
                    for name, limit in BUDGETS.items()
                ],
            },
        )

    api.call("PATCH", "/api/me/settings", {"roast_enabled": True, "roast_tone": "savage"})
    print(f"Seeded {count} transactions and budgets for {month_of(first_last)}, {month_of(today)}.")
    print(f"Log in at {args.base_url} with {args.email} / {args.password}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
