# test_questions.py

import pytest
from fastapi.testclient import TestClient

# ------------------------------------------------------------------ imports
import app.routes.download as qroute  # route with FileResponse
import app.services.download.questions as qmod  # QuestionsDownloader


# ------------------------------------------------------------------ helpers
class _FakeResult:
    def __init__(self, data):
        self.data = data


class FakeSupabase:
    """Stub for table(..).select(..).in_(..).execute().data chain."""

    def __init__(self, questions):
        self._tables = {"questions": questions}

    def table(self, name):
        self._current = self._tables[name]
        return self

    def select(self, *_a, **_kw):
        return self

    def in_(self, field, values):
        self._current = [r for r in self._current if r[field] in values]
        return self

    def execute(self):
        return _FakeResult(self._current)


# ---------------------------------------------------------------- fixtures
@pytest.fixture()
def client(monkeypatch, tmp_path):
    # ----- fake QUESTIONS_DIR so nothing touches real FS
    monkeypatch.setattr(qroute, "QUESTIONS_DIR", tmp_path, raising=False)
    monkeypatch.setattr(qmod, "QUESTIONS_DIR", tmp_path, raising=False)

    # ----- sample question set (one MCQ, one FRQ)
    qs = [
        {
            "id": "q1",
            "title": "Sample MCQ",
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
            "title": "Sample FRQ",
            "problem": "Explain Newton's 2nd law.",
            "solution": "F = m a.",
            "figures": [],
            "references": [],
            "frq": True,
        },
    ]
    monkeypatch.setattr(
        qroute,
        "get_supabase",
        lambda: FakeSupabase(qs),
    )

    # ----- short‑circuit heavy PyLaTeX work ------------------------
    def fake_save(self, name, questions, base_filename, pdf=True):
        """Write a stub file that matches the downloader's expected path."""
        out_dir = tmp_path / name
        out_dir.mkdir(parents=True, exist_ok=True)
        ext = "pdf" if pdf else "tex"
        path = out_dir / f"{base_filename}.{ext}"  # <-- use *sanitised* name
        path.write_bytes(
            b"%PDF-STUB\n" if ext == "pdf" else b"\\documentclass{article}"
        )
        return True

    monkeypatch.setattr(qmod.QuestionsDownloader, "save", fake_save)

    from app.main import app

    return TestClient(app)


# ---------------------------------------------------------------- utils
def _qget(client, fmt, ids, zip=False):
    return client.get(
        "/download/questions",
        params={
            "chat_id": "chatA",
            "question_ids": ids,
            "format": fmt,
            "zip": str(zip).lower(),
        },
    )


# ---------------------------------------------------------------- tests
@pytest.mark.parametrize(
    "fmt,ctype,zip_flag",
    [
        ("latex", "application/x-tex", False),
        ("pdf", "application/pdf", False),
        ("latex", "application/zip", True),
        ("pdf", "application/zip", True),
    ],
)
def test_download_variants(client, fmt, ctype, zip_flag):
    r = _qget(client, fmt, ["q1", "q2"], zip=zip_flag)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith(ctype)
    if ctype == "application/zip":
        import zipfile
        import io

        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            assert len(z.namelist()) == 2
    else:
        if fmt == "latex":
            assert b"\\documentclass" in r.content
        else:
            assert r.content.startswith(b"%PDF")


def test_invalid_format(client):
    # anything except pdf/latex should 422 at FastAPI level
    r = _qget(client, "text", ["q1"])
    assert r.status_code == 422


def test_questions_not_found(client, monkeypatch):
    monkeypatch.setattr(qroute, "get_supabase", lambda: FakeSupabase([]))
    r = _qget(client, "pdf", ["nope"])  # was "text"
    assert r.status_code == 404
    assert r.json()["detail"] == "Questions not found"


def test_missing_params(client):
    r = client.get("/download/questions", params={"chat_id": "x", "format": "text"})
    assert r.status_code == 422
