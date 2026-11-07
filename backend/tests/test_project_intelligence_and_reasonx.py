"""Tests for Project Intelligence Report and ReasonX Context-Aware Assistant.

Covers:
- Project Intelligence Report generation from persistent database records
- Executive questions answers and readiness metrics
- Report regeneration and exports (Markdown, JSON, Print/PDF)
- ReasonX context-aware chat handling with mock fixtures
- Conversation persistence, history listing, and deletion
- Quick prompt resolution across application screens
"""
from __future__ import annotations

import pytest


def test_project_intelligence_report_generation(admin):
    """Test generating and fetching Project Intelligence Report for a project."""
    r_projs = admin.get("/projects")
    assert r_projs.status_code == 200
    items = r_projs.json().get("items", [])
    assert len(items) > 0
    project_id = items[0]["id"]

    # Request intelligence report
    res = admin.get(f"/projects/{project_id}/intelligence-report")
    assert res.status_code == 200
    report = res.json()

    # Verify root fields
    assert report["project_id"] == project_id
    assert "project_name" in report
    assert "project_key" in report
    assert "business_domain" in report
    assert "readiness_score" in report

    # Verify Executive Summary
    exec_summary = report.get("executive_summary", {})
    assert "headline" in exec_summary
    assert "what_was_analysed" in exec_summary
    assert "what_was_discovered" in exec_summary
    assert "what_is_working" in exec_summary
    assert "major_concerns" in exec_summary
    assert "human_review_needed" in exec_summary
    assert "next_actions" in exec_summary

    # Verify Stage Readiness
    stage_readiness = report.get("stage_readiness", {})
    assert "stage_1_ready" in stage_readiness
    assert "stage_2_ready" in stage_readiness
    assert "clause_maturity" in stage_readiness
    assert "controls_verified" in stage_readiness
    assert "status_timeline" in stage_readiness

    # Verify Metrics By Area
    metrics = report.get("metrics_by_area", [])
    assert len(metrics) > 0
    for m in metrics:
        assert "area" in m
        assert "score" in m
        assert "status" in m

    # Verify Critical Gaps & Recommendations
    gaps = report.get("critical_gaps", [])
    assert isinstance(gaps, list)
    recs = report.get("recommendations", [])
    assert isinstance(recs, list)


def test_project_intelligence_report_regeneration(admin):
    """Test explicit regeneration endpoint creates or updates report."""
    r_projs = admin.get("/projects")
    project_id = r_projs.json()["items"][0]["id"]

    res = admin.post(f"/projects/{project_id}/intelligence-report/regenerate", json={})
    assert res.status_code == 200
    data = res.json()
    assert data["project_id"] == project_id
    assert "report_id" in data
    assert "readiness_score" in data


def test_project_intelligence_report_exports(admin):
    """Test exporting report in Markdown, JSON, and PDF formats."""
    r_projs = admin.get("/projects")
    project = r_projs.json()["items"][0]
    project_id = project["id"]

    # Markdown export
    r_md = admin.get(f"/projects/{project_id}/intelligence-report/export?format=markdown")
    assert r_md.status_code == 200
    assert "text/markdown" in r_md.headers.get("content-type", "")
    assert "Project Intelligence & Executive Readiness Report" in r_md.text

    # JSON export
    r_json = admin.get(f"/projects/{project_id}/intelligence-report/export?format=json")
    assert r_json.status_code == 200
    assert "application/json" in r_json.headers.get("content-type", "")
    json_data = r_json.json()
    assert json_data["project_id"] == project_id

    # Print / PDF HTML export
    r_pdf = admin.get(f"/projects/{project_id}/intelligence-report/export?format=pdf")
    assert r_pdf.status_code == 200
    assert "text/html" in r_pdf.headers.get("content-type", "")
    assert "<!DOCTYPE html>" in r_pdf.text


def test_reasonx_quick_prompts(admin):
    """Test quick prompt suggestions across various application screens."""
    pages = ["intelligence_report", "requirements", "simulation", "tests", "defects", "dashboard"]
    for p in pages:
        res = admin.get(f"/reasonx/quick-prompts?page={p}")
        assert res.status_code == 200
        prompts = res.json().get("prompts", [])
        assert len(prompts) >= 3


def test_reasonx_chat_flow_and_history(admin):
    """Test full multi-turn ReasonX conversation with context, citations, and history."""
    r_projs = admin.get("/projects")
    project_id = r_projs.json()["items"][0]["id"]

    # 1. First turn: ask an executive readiness question
    chat_payload = {
        "project_id": project_id,
        "page": "intelligence_report",
        "query": "What is our current readiness status and what are the critical gaps?",
    }
    r_turn1 = admin.post("/reasonx/chat", json=chat_payload)
    assert r_turn1.status_code == 200
    res1 = r_turn1.json()

    assert "conversation_id" in res1
    conv_id = res1["conversation_id"]
    assert res1["role"] == "assistant"
    assert len(res1["content"]) > 0

    # Verify structured payload
    payload1 = res1.get("structured_payload")
    assert payload1 is not None
    assert "direct_answer" in payload1
    assert "explanation" in payload1
    assert "recommended_actions" in payload1

    # 2. Second turn: follow up in the same conversation
    chat_payload_2 = {
        "project_id": project_id,
        "conversation_id": conv_id,
        "page": "intelligence_report",
        "query": "Which gaps require immediate board attention?",
    }
    r_turn2 = admin.post("/reasonx/chat", json=chat_payload_2)
    assert r_turn2.status_code == 200
    res2 = r_turn2.json()
    assert res2["conversation_id"] == conv_id

    # 3. Retrieve conversation history
    r_msgs = admin.get(f"/reasonx/conversations/{conv_id}/messages")
    assert r_msgs.status_code == 200
    msgs = r_msgs.json().get("messages", [])
    assert len(msgs) >= 4  # 2 user turns + 2 assistant turns

    # 4. List conversations for project
    r_convs = admin.get(f"/reasonx/projects/{project_id}/conversations")
    assert r_convs.status_code == 200
    conv_list = r_convs.json().get("conversations", [])
    assert any(c["id"] == conv_id for c in conv_list)

    # 5. Delete conversation
    r_del = admin._send("DELETE", f"/reasonx/conversations/{conv_id}")
    assert r_del.status_code == 200
    assert r_del.json().get("deleted") is True
