from fastapi.testclient import TestClient

from aria_engine.app import app

client = TestClient(app)


def test_health_ok(monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "")
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["muse"]["key_set"] is False


def test_health_reports_key_without_leaking_it(monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "secret-test-value")
    res = client.get("/health")
    assert res.json()["muse"]["key_set"] is True
    assert "secret-test-value" not in res.text


def test_cors_allows_ui_from_disk():
    res = client.get("/health", headers={"Origin": "null"})
    assert res.headers.get("access-control-allow-origin") == "null"


def test_cors_refuses_other_sites():
    res = client.get("/health", headers={"Origin": "https://example.com"})
    assert "access-control-allow-origin" not in res.headers
