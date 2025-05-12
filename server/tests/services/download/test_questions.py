# tests/test_questions.py
from __future__ import annotations

import io
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app.routes.download_route as qroute  # FastAPI handler
import app.services.download.questions as qmod  # QuestionsDownloader
from app.main import app


# ───────────────────────── helpers ──────────────────────────
class FakeSupabase:
    """Tiny stub for .table().select().in_().execute().data chain."""

    def __init__(self, questions):
        self._tables = {"questions": questions}

    def table(self, name):
        self._cur = self._tables[name]
        return self

    def select(self, *_, **__):
        return self

    def in_(self, field, vals):
        self._cur = [r for r in self._cur if r[field] in vals]
        return self

    def execute(self):
        return type("R", (), {"data": self._cur})()


# ───────────────────────── fixtures ──────────────────────────
@pytest.fixture()
def client(monkeypatch, tmp_path: Path) -> TestClient:
    # redirect QUESTIONS_DIR
    monkeypatch.setattr(qroute, "QUESTIONS_DIR", tmp_path, False)
    monkeypatch.setattr(qmod, "QUESTIONS_DIR", tmp_path, False)

    # sample MCQ + FRQ
    questions = [
        {
            "id": "q1",
            "title": "MCQ",
            "problem": "2+2 = ?",
            "options": ["1", "2", "3", "4"],
            "answers": ["3"],
            "explanations": ["", "", "", "Because 2+2=4"],
            "figures": [],
            "references": [],
            "frq": False,
        },
        {
            "id": "q2",
            "title": "FRQ",
            "problem": "Explain Newton's 2nd law.",
            "solution": "F = m a.",
            "figures": [],
            "references": [],
            "frq": True,
        },
    ]
    monkeypatch.setattr(qroute, "get_supabase", lambda: FakeSupabase(questions))

    # stub heavy LaTeX work – just write a tiny file where downloader expects
    def fake_save(self, name, qs, base, pdf=True):
        out_dir = tmp_path / name
        out_dir.mkdir(parents=True, exist_ok=True)
        ext = "pdf" if pdf else "tex"
        p = out_dir / f"{base}.{ext}"
        p.write_bytes(b"%PDF" if pdf else b"\\documentclass{article}")
        return True

    monkeypatch.setattr(qmod.QuestionsDownloader, "save", fake_save, raising=True)
    return TestClient(app)


# ───────────────────────── utilities ──────────────────────────
def _dl(client, fmt, ids, zip_flag=False):
    return client.get(
        "/download/questions",
        params={
            "chat_id": "chatA",
            "question_ids": ids,
            "format": fmt,
            "zip": str(zip_flag).lower(),
        },
    )


# ───────────────────────── tests ──────────────────────────
@pytest.mark.parametrize(
    ("fmt", "expect_ct", "zip_flag"),
    [
        ("latex", "application/x-tex", False),
        ("pdf", "application/pdf", False),
        ("latex", "application/zip", True),
        ("pdf", "application/zip", True),
    ],
)
def test_download_variants(client, fmt, expect_ct, zip_flag):
    r = _dl(client, fmt, ["q1", "q2"], zip_flag)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith(expect_ct)

    if expect_ct == "application/zip":
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            assert len(z.namelist()) == 2
    else:
        assert (
            (b"%PDF" in r.content)
            if fmt == "pdf"
            else (b"\\documentclass" in r.content)
        )


def test_invalid_format(client):
    assert _dl(client, "text", ["q1"]).status_code == 422


def test_questions_not_found(client, monkeypatch):
    monkeypatch.setattr(qroute, "get_supabase", lambda: FakeSupabase([]))
    r = _dl(client, "pdf", ["nope"])
    assert r.status_code == 404 and r.json()["detail"] == "Questions not found"


def test_missing_params(client):
    r = client.get("/download/questions", params={"chat_id": "x", "format": "pdf"})
    assert r.status_code == 422
