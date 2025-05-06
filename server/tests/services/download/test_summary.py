# test_summary.py

import io
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# ------------------------------------------------------------------ imports
import app.routes.download_route as droute  # router that owns /summary
import app.services.download.summaries as smod  # SummaryDownloader


# ------------------------------------------------------------------ helpers
class _FakeResult:
    def __init__(self, data):
        self.data = data


class FakeSupabase:
    """Very small stub matching table(..).select(..).eq/in_.execute().data chain."""

    def __init__(self, tables):
        self._tables = tables

    # supabase.table(...)
    def table(self, name):
        self._current = self._tables[name]
        return self

    # .select(...)
    def select(self, *_a, **_kw):
        return self

    # .eq(...)
    def eq(self, field, value):
        self._current = [r for r in self._current if r[field] == value]
        return self

    # .in_(...)
    def in_(self, field, values):
        self._current = [r for r in self._current if r[field] in values]
        return self

    def execute(self):
        return _FakeResult(self._current)


# ---------------------------------------------------------------- fixtures
@pytest.fixture()
def client(monkeypatch, tmp_path):
    # ----- isolate SUMMARY dir so nothing pollutes real FS ──────────────
    monkeypatch.setattr(droute, "SUMMARIES_DIR", tmp_path, raising=False)
    monkeypatch.setattr(smod, "SUMMARIES_DIR", tmp_path, raising=False)

    # ----- sample DB rows ------------------------------------------------
    chats = [{"id": "chat1", "class": "classA", "name": "Demo Chat"}]

    summaries = [
        {
            "id": "s1",
            "title": "First Summary",
            "preamble": "Intro text.",
            "body": "Main body.",
            "conclusion": "Done.",
            "references": [],
            "figures": [],
        },
        {
            "id": "s2",
            "title": "Second Summary",
            "preamble": "Start.",
            "body": "Another body.",
            "conclusion": "Finish.",
            "references": [],
            "figures": [],
        },
    ]

    # docs / figures tables can be empty for these tests
    tables = {
        "chats": chats,
        "summaries": summaries,
        "figures": [],
        "documents": [],
        "files": [],
    }

    monkeypatch.setattr(droute, "get_supabase", lambda: FakeSupabase(tables))

    # ----- stub heavy generation work -----------------------------------
    # 1) write a stub file & return True
    def fake_save(self, directory, summaries, base, title, pdf=True):
        Path(directory).mkdir(parents=True, exist_ok=True)
        ext = "pdf" if pdf else "tex"
        path = Path(directory) / f"{base}.{ext}"
        header = b"%PDF-STUB\n" if pdf else b"\\documentclass{article}\n"
        path.write_bytes(header + title.encode())
        return True

    monkeypatch.setattr(smod.SummaryDownloader, "save", fake_save)

    # 2) DO NOT stub zip_* — we want to exercise the real logic that now
    #    builds each summary in its own downloader.

    from app.main import app

    return TestClient(app)


# ---------------------------------------------------------------- utils
def _sget(client, fmt, ids, zip=False):
    return client.get(
        "/download/summary",
        params={
            "chat_id": "chat1",
            "summary_ids": ids,
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
    r = _sget(client, fmt, ["s1", "s2"], zip=zip_flag)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith(ctype)
    if ctype == "application/zip":
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            # two summaries → two files
            assert len(z.namelist()) == 2
    elif fmt == "latex":
        assert b"\\documentclass" in r.content
    else:
        assert r.content.startswith(b"%PDF")


def test_zip_individual_files_are_singleton_summaries(client):
    # ask for two summaries zipped
    r = _sget(client, "pdf", ["s1", "s2"], zip=True)
    assert r.status_code == 200

    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        # file names are sane
        names = sorted(z.namelist())
        assert names == ["First_Summary.pdf", "Second_Summary.pdf"]

        first = z.read("First_Summary.pdf")
        second = z.read("Second_Summary.pdf")

        # each stub PDF must mention ONLY its own title
        assert b"First Summary" in first and b"Second Summary" not in first
        assert b"Second Summary" in second and b"First Summary" not in second


def test_chat_not_found(client, monkeypatch):
    empty_tables = {
        "chats": [],
        "summaries": [],
        "figures": [],
        "documents": [],
        "files": [],
    }
    monkeypatch.setattr(droute, "get_supabase", lambda: FakeSupabase(empty_tables))
    r = _sget(client, "pdf", ["s1"])
    assert r.status_code == 404
    assert r.json()["detail"] == "Chat not found"


def test_summaries_not_found(client, monkeypatch):
    tables = {
        "chats": [{"id": "chat1", "class": "c", "name": "Chat"}],
        "summaries": [],
        "figures": [],
        "documents": [],
        "files": [],
    }
    monkeypatch.setattr(droute, "get_supabase", lambda: FakeSupabase(tables))
    r = _sget(client, "pdf", ["nope"])
    assert r.status_code == 404
    assert r.json()["detail"] == "Summaries not found"


def test_invalid_format(client):
    r = _sget(client, "text", ["s1"])
    assert r.status_code == 422  # FastAPI enum validation


def test_missing_params(client):
    r = client.get("/download/summary", params={"chat_id": "chat1", "format": "pdf"})
    assert r.status_code == 422
