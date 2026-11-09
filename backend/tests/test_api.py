from collections.abc import Iterator
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.api.rate_limit import limiter
from app.config import Settings
from app.db import get_session
from app.main import app


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    test_settings = Settings(
        env="test",
        jwt_secret="test-" * 8,
    )
    monkeypatch.setattr("app.security.get_settings", lambda: test_settings)
    limiter.reset()  # registration is limited to 10/minute; each test starts fresh
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(test_engine)

    def override_session() -> Iterator[Session]:
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    monkeypatch.setattr("app.api.transactions.engine", test_engine)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    test_engine.dispose()


def register(client: TestClient, email: str) -> tuple[str, dict[str, int]]:
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": "strong-password", "display_name": "Test"},
    )
    assert response.status_code == 201
    token = response.json()["access_token"]
    categories = client.get("/api/categories", headers={"Authorization": f"Bearer {token}"}).json()
    return token, {category["name"]: category["id"] for category in categories}


def test_registration_auth_categories_and_user_isolation(client: TestClient) -> None:
    token_a, categories_a = register(client, "a@example.com")
    token_b, _ = register(client, "b@example.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    assert len(categories_a) == 12
    assert client.get("/api/me", headers=headers_a).json()["email"] == "a@example.com"
    assert (
        client.post(
            "/api/auth/login", json={"email": "a@example.com", "password": "strong-password"}
        ).status_code
        == 200
    )
    created = client.post(
        "/api/transactions",
        headers=headers_a,
        json={
            "kind": "expense",
            "amount": 50000,
            "category_id": categories_a["Ăn uống"],
            "date": "2026-11-06",
            "note": "coffee",
        },
    )
    assert created.status_code == 201
    transaction_id = created.json()["transaction"]["id"]
    assert (
        client.patch(
            f"/api/transactions/{transaction_id}",
            headers=headers_b,
            json={"amount": 100000},
        ).status_code
        == 404
    )
    assert client.get("/api/transactions", headers=headers_b).json() == []
    category_b_id = client.get("/api/categories", headers=headers_b).json()[0]["id"]
    assert category_b_id != categories_a["Ăn uống"]


def test_budgets_dashboard_export_and_roast_alert_flow(client: TestClient) -> None:
    token, categories = register(client, "flow@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    budget = client.put(
        "/api/budgets",
        headers=headers,
        json={
            "month": "2026-11",
            "total": 3_000_000,
            "categories": [{"category_id": categories["Ăn uống"], "limit": 2_500_000}],
        },
    )
    assert budget.status_code == 200
    assert budget.json()["total"]["limit"] == 3_000_000
    assert budget.json()["categories"][0]["usage_pct"] == 0

    created = client.post(
        "/api/transactions",
        headers=headers,
        json={
            "kind": "expense",
            "amount": 2_100_000,
            "category_id": categories["Ăn uống"],
            "date": "2026-11-06",
            "note": "=SUM(A1:A2)",
        },
    )
    assert created.status_code == 201
    assert created.json()["roast_pending"] is True
    alerts = client.get("/api/ai/alerts?unread=true", headers=headers)
    assert alerts.status_code == 200
    assert len(alerts.json()) == 1
    alert_id = alerts.json()[0]["id"]
    assert client.post(f"/api/ai/alerts/{alert_id}/read", headers=headers).status_code == 204
    assert client.get("/api/ai/alerts?unread=true", headers=headers).json() == []
    assert client.post(f"/api/ai/alerts/{alert_id}/report", headers=headers).status_code == 204
    dashboard = client.get("/api/dashboard?month=2026-11", headers=headers).json()
    assert (dashboard["income"], dashboard["expense"], dashboard["balance"]) == (
        0,
        2_100_000,
        -2_100_000,
    )
    csv_response = client.get("/api/transactions/export?month=2026-11", headers=headers)
    assert csv_response.status_code == 200
    assert "'=SUM(A1:A2)" in csv_response.text
    assert (
        client.post(
            "/api/ai/chat", headers=headers, json={"question": "How can I spend less?"}
        ).status_code
        == 200
    )
    assert client.get("/api/ai/report?month=2026-11", headers=headers).status_code == 200
    parsed = client.post("/api/ai/parse", headers=headers, json={"text": "trà sữa 45k"})
    assert parsed.status_code == 200
    assert parsed.json()["amount"] == 45_000


def test_same_roast_trigger_is_deduplicated(client: TestClient) -> None:
    token, categories = register(client, "dedupe@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "kind": "expense",
        "amount": 1,
        "category_id": categories["Ăn uống"],
        "date": "2026-11-06",
    }
    results = [
        client.post("/api/transactions", headers=headers, json=payload).json() for _ in range(4)
    ]
    assert [item["roast_pending"] for item in results] == [False, False, True, False]
    alerts = client.get("/api/ai/alerts", headers=headers).json()
    assert len(alerts) == 1
    assert alerts[0]["trigger"] == "repeat_today"


def test_roast_disabled_and_unread_data_isolation(client: TestClient) -> None:
    token_a, categories_a = register(client, "roast-off@example.com")
    token_b, _ = register(client, "other@example.com")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    settings = client.patch("/api/me/settings", headers=headers_a, json={"roast_enabled": False})
    assert settings.status_code == 200
    result = client.post(
        "/api/transactions",
        headers=headers_a,
        json={
            "kind": "expense",
            "amount": 500_000,
            "category_id": categories_a["Ăn uống"],
            "date": "2026-11-06",
        },
    )
    assert result.status_code == 201
    assert result.json()["roast_pending"] is False
    assert client.get("/api/ai/alerts", headers=headers_a).json() == []
    assert client.get("/api/ai/alerts", headers=headers_b).json() == []


def test_chat_logs_a_spending_statement_but_not_a_question(client: TestClient) -> None:
    token, categories = register(client, "chat@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    reply = client.post(
        "/api/ai/chat", headers=headers, json={"question": "Nay tôi ăn bánh cuốn hết 50k"}
    )
    assert reply.status_code == 200
    body = reply.json()
    assert body["transaction"]["amount"] == 50_000
    assert body["transaction"]["category_id"] == categories["Ăn uống"]
    assert body["text"].startswith("Đã ghi khoản chi 50.000đ vào mục Ăn uống")
    listed = client.get("/api/transactions", headers=headers).json()
    assert [tx["amount"] for tx in listed] == [50_000]

    question = client.post(
        "/api/ai/chat",
        headers=headers,
        json={"question": "Mình có đủ tiền mua tai nghe 2 triệu không?"},
    ).json()
    assert question["transaction"] is None and question["roast_pending"] is False
    assert len(client.get("/api/transactions", headers=headers).json()) == 1


def test_default_category_icons_are_emoji(client: TestClient) -> None:
    token, _ = register(client, "icons@example.com")
    categories = client.get("/api/categories", headers={"Authorization": f"Bearer {token}"}).json()
    assert all(category["icon"] and not category["icon"].isascii() for category in categories)


def test_categories_have_a_color_the_user_can_change(client: TestClient) -> None:
    token, _ = register(client, "colors@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    categories = client.get("/api/categories", headers=headers).json()
    assert all(c["color"].startswith("#") and len(c["color"]) == 7 for c in categories)
    food = next(c for c in categories if c["name"] == "Ăn uống")

    changed = client.patch(
        f"/api/categories/{food['id']}", json={"color": "#123abc"}, headers=headers
    )
    assert changed.status_code == 200 and changed.json()["color"] == "#123abc"
    bad = client.patch(f"/api/categories/{food['id']}", json={"color": "red"}, headers=headers)
    assert bad.status_code == 422
    created = client.post(
        "/api/categories",
        json={"name": "Cà phê", "kind": "expense", "color": "#00aa88"},
        headers=headers,
    )
    assert created.json()["color"] == "#00aa88"


def test_dashboard_splits_each_day_by_category(client: TestClient) -> None:
    token, _ = register(client, "daily@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    categories = {c["name"]: c["id"] for c in client.get("/api/categories", headers=headers).json()}
    today = date.today().isoformat()
    for name, amount in [("Ăn uống", 50_000), ("Ăn uống", 30_000), ("Di chuyển", 100_000)]:
        client.post(
            "/api/transactions",
            json={
                "kind": "expense",
                "amount": amount,
                "category_id": categories[name],
                "date": today,
            },
            headers=headers,
        )
    day = next(
        d
        for d in client.get("/api/dashboard", headers=headers).json()["daily"]
        if d["date"] == today
    )
    assert day["expense"] == 180_000
    assert day["categories"] == [
        {"category_id": categories["Di chuyển"], "amount": 100_000},
        {"category_id": categories["Ăn uống"], "amount": 80_000},
    ]


def test_old_database_gets_the_color_column(tmp_path) -> None:  # type: ignore[no-untyped-def]
    from sqlalchemy import create_engine, text

    from app.db import add_category_color_column

    engine = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE categories (id INTEGER PRIMARY KEY, user_id INT, name TEXT,"
                " kind TEXT, icon TEXT, is_default BOOLEAN)"
            )
        )
        conn.execute(
            text("INSERT INTO categories VALUES (1, 1, 'Ăn uống', 'expense', 'utensils', 1)")
        )
        conn.execute(text("INSERT INTO categories VALUES (2, 1, 'Cà phê', 'expense', '', 0)"))
        add_category_color_column(conn)
        add_category_color_column(conn)  # running it twice is harmless
        rows = conn.execute(text("SELECT name, color FROM categories ORDER BY id")).all()
    assert rows == [("Ăn uống", "#2a78d6"), ("Cà phê", "")]


def test_user_can_rename_their_account(client: TestClient) -> None:
    token, _ = register(client, "rename@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    renamed = client.patch(
        "/api/me/settings", json={"display_name": "  Vi Nguyễn  "}, headers=headers
    )
    assert renamed.status_code == 200 and renamed.json()["display_name"] == "Vi Nguyễn"
    assert client.get("/api/me", headers=headers).json()["display_name"] == "Vi Nguyễn"
    for bad in ["   ", "", "x" * 81]:
        response = client.patch("/api/me/settings", json={"display_name": bad}, headers=headers)
        assert response.status_code == 422, bad
    assert client.get("/api/me", headers=headers).json()["display_name"] == "Vi Nguyễn"
