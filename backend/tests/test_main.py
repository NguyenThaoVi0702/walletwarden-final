from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import SPAStaticFiles, app


def test_health() -> None:
    body = TestClient(app).get("/api/health").json()
    assert body["status"] == "ok" and "chain" in body["ai"]


def test_spa_fallback(tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<div id=root></div>")
    (tmp_path / "app.js").write_text("console.log(1)")
    spa = FastAPI()
    spa.mount("/", SPAStaticFiles(directory=tmp_path, html=True))
    client = TestClient(spa)
    assert client.get("/app.js").text == "console.log(1)"
    assert "root" in client.get("/dashboard").text  # client-side route
    assert client.get("/api/unknown").status_code == 404  # API stays a real 404
