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


def test_other_sites_cant_run_anything():
    # A page elsewhere can send a POST with no Content-Type (the body still parses as JSON): it must be refused
    res = client.post("/groove/match", content=b'{"a": 1}', headers={"Origin": "https://example.com", "Content-Type": ""})
    assert res.status_code == 403
    assert client.get("/health", headers={"Origin": "https://example.com"}).status_code == 403


def test_aria_pages_and_the_bridge_still_get_through():
    for headers in ({}, {"Origin": "null"}, {"Origin": "file://"}, {"Origin": "http://localhost:5173"}, {"Origin": "http://127.0.0.1:8765"}):
        assert client.get("/health", headers=headers).status_code == 200
    assert client.post("/groove/match", json={}, headers={"Origin": "null"}).status_code == 422   # reaches validation
