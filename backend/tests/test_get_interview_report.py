"""Regression test for the ``GET /api/interview/{session_id}`` endpoint.

After the migration from in-memory storage to PostgreSQL, ``final_report``
is persisted as a ``TEXT`` column containing ``json.dumps(...)`` of the
report dict. The endpoint used to forward that string straight back to the
client, which broke the ``/report/:sessionId`` page because the frontend
expects ``final_report`` to be a JSON object.

These tests pin the contract: the response must always return
``final_report`` as a parsed dict (or ``None``), regardless of whether the
underlying database row stores it as a string.
"""
from __future__ import annotations

import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

import server


@pytest.fixture
def client() -> TestClient:
    return TestClient(server.app)


# A realistic report shape that mirrors what ``call_reporter`` produces.
SAMPLE_REPORT_DICT = {
    "overall_score": 85,
    "verdict": "Hire",
    "summary": "Solid DevOps fundamentals with room to grow on Kubernetes depth.",
    "strengths": ["Clear incident communication", "Strong CI/CD intuition"],
    "weaknesses": ["Limited Kubernetes networking knowledge"],
    "topic_mastery": [
        {"topic": "kubernetes", "score": 70, "notes": "Comfortable with pods, weak on networking"},
        {"topic": "terraform", "score": 90, "notes": "Confident with modules and state"},
    ],
    "recommendations": ["Deep-dive into CNI plugins", "Practice multi-region IaC patterns"],
    "next_level_readiness": "Ready for mid-level DevOps roles",
}

SAMPLE_REPORT_JSON = json.dumps(SAMPLE_REPORT_DICT)


def _build_row(**overrides):
    """Build a fake DB row as returned by ``database.get_interview``."""
    row = {
        "id": 1,
        "session_id": "test-session-id",
        "user_id": None,
        "candidate_name": "Jane Doe",
        "topics": "kubernetes,terraform",
        "difficulty": "mid",
        "mode": "text",
        "duration_minutes": 60,
        "started_at": "2026-07-10T10:00:00+00:00",
        "ended_at": "2026-07-10T11:00:00+00:00",
        "status": "completed",
        "final_report": SAMPLE_REPORT_JSON,  # stored as a JSON string in TEXT
        "messages": [],
        "scores": [],
        "system_prompt": "secret-do-not-leak",
    }
    row.update(overrides)
    return row


def test_get_interview_parses_final_report_string_to_dict(client: TestClient):
    """A row whose ``final_report`` is a JSON string must be returned as a dict."""
    fake_row = _build_row()

    with patch.object(server.database, "get_interview", return_value=fake_row) as mock_get:
        response = client.get("/api/interview/test-session-id")

    mock_get.assert_called_once_with("test-session-id")
    assert response.status_code == 200

    body = response.json()
    final_report = body.get("final_report")

    # Core regression assertion: must be a dict, not a string.
    assert isinstance(final_report, dict), (
        f"final_report should be parsed to a dict, got {type(final_report).__name__}: {final_report!r}"
    )
    assert final_report["overall_score"] == 85
    assert final_report["verdict"] == "Hire"
    assert final_report["summary"]
    assert isinstance(final_report["strengths"], list)
    assert isinstance(final_report["weaknesses"], list)
    assert isinstance(final_report["topic_mastery"], list)
    assert final_report["topic_mastery"][0]["topic"] == "kubernetes"


def test_get_interview_does_not_leak_system_prompt(client: TestClient):
    """The endpoint must still strip ``system_prompt`` after the fix."""
    fake_row = _build_row()

    with patch.object(server.database, "get_interview", return_value=fake_row):
        response = client.get("/api/interview/test-session-id")

    assert response.status_code == 200
    assert "system_prompt" not in response.json()


def test_get_interview_returns_none_when_final_report_absent(client: TestClient):
    """Sessions without a report should return ``final_report: null`` (not the empty string)."""
    fake_row = _build_row(final_report=None, status="active")

    with patch.object(server.database, "get_interview", return_value=fake_row):
        response = client.get("/api/interview/test-session-id")

    assert response.status_code == 200
    assert response.json()["final_report"] is None


def test_get_interview_returns_404_when_session_missing(client: TestClient):
    """Missing sessions still 404 after the fix."""
    with patch.object(server.database, "get_interview", return_value=None):
        response = client.get("/api/interview/does-not-exist")

    assert response.status_code == 404
