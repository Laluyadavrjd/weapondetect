"""Health + model-info endpoint tests."""

REQUIRED_KEYS = {"status", "model_status", "model_name", "device", "version"}


def test_health_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert REQUIRED_KEYS <= set(body.keys())
    assert body["status"] == "ok"
    assert body["model_status"] in ("ready", "unavailable")


def test_model_info_schema(client):
    r = client.get("/api/model-info")
    assert r.status_code == 200
    body = r.json()
    for key in (
        "model_family", "checkpoint", "checkpoint_status", "classes",
        "input_size", "default_confidence", "device", "loaded",
    ):
        assert key in body, f"missing key {key}"
    assert isinstance(body["classes"], list)
    if body["loaded"]:
        assert len(body["classes"]) > 0
        ids = {c["id"] for c in body["classes"]}
        names = {c["name"] for c in body["classes"]}
        assert "person" in names  # COCO baseline sanity
        assert 0 in ids
    else:
        assert body["checkpoint_status"] == "missing"


def test_metrics_available_after_evaluation(client):
    # The Colab-trained checkpoint's evaluation report is wired in at
    # training/evaluation/reports/metrics.json, so /api/metrics must serve
    # the real numbers. (Before training this asserted available=False.)
    r = client.get("/api/metrics")
    assert r.status_code == 200
    body = r.json()
    assert body["available"] is True
    assert body["classes"] and "pistol" in body["classes"]
    assert 0 < body["map50"] <= 1
    assert len(body["per_class"]) == len(body["classes"])
