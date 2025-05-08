# tests/test_summary.py
from __future__ import annotations

import io
import zipfile
from pathlib import Path
from typing import Any, Dict, List

import pytest
from fastapi.testclient import TestClient

import app.routes.download_route as droute
import app.services.download.summaries as smod
from app.main import app


# ───────────────────────── helpers ──────────────────────────
class FakeSupabase:
    """Stub for table(...).select(...).eq/in_(...).execute().data"""

    def __init__(self, tables: dict[str, list[dict]]):
        self._tables = tables

    def table(self, name: str):
        self._cur = self._tables[name]
        return self

    def select(self, *_, **__):
        return self

    def eq(self, k, v):
        self._cur = [r for r in self._cur if r[k] == v]
        return self

    def in_(self, k, vs):
        self._cur = [r for r in self._cur if r[k] in vs]
        return self

    def execute(self):
        return type("R", (), {"data": self._cur})()


# ───────────────────────── fixtures ──────────────────────────
@pytest.fixture()
def client(monkeypatch, tmp_path: Path) -> TestClient:
    # isolate FS
    monkeypatch.setattr(droute, "SUMMARIES_DIR", tmp_path, raising=False)
    monkeypatch.setattr(smod, "SUMMARIES_DIR", tmp_path, raising=False)

    # fake DB rows
    chats = [{"id": "chat1", "class": "classA", "name": "Demo"}]
    summaries = [
        {
            "id": "s1",
            "title": "First",
            "preamble": "A",
            "body": "B",
            "conclusion": "C",
            "references": [],
            "figures": [],
        },
        {
            "id": "s2",
            "title": "Second",
            "preamble": "X",
            "body": "Y",
            "conclusion": "Z",
            "references": [],
            "figures": [],
        },
    ]
    tables: Dict[str, List[Dict[Any, Any]]] = {
        "chats": chats,
        "summaries": summaries,
        "figures": [],
        "documents": [],
        "files": [],
    }
    monkeypatch.setattr(droute, "get_supabase", lambda: FakeSupabase(tables))

    # stub out the save() that writes files
    def fake_save(self, directory, sums, base, title, pdf=True):
        Path(directory).mkdir(parents=True, exist_ok=True)
        ext = "pdf" if pdf else "tex"
        p = Path(directory) / f"{base}.{ext}"
        p.write_bytes((b"%PDF\n" if pdf else b"\\documentclass\n") + title.encode())
        return True

    monkeypatch.setattr(smod.SummaryDownloader, "save", fake_save, raising=True)
    return TestClient(app)


# ───────────────────────── utility ──────────────────────────
def _dl(client, fmt, ids, zip_flag=False):
    return client.get(
        "/download/summary",
        params={
            "chat_id": "chat1",
            "summary_ids": ids,
            "format": fmt,
            "zip": str(zip_flag).lower(),
        },
    )


# ───────────────────────── tests ──────────────────────────
@pytest.mark.parametrize(
    ("fmt", "ctype", "zip_flag"),
    [
        ("latex", "application/x-tex", False),
        ("pdf", "application/pdf", False),
        ("latex", "application/zip", True),
        ("pdf", "application/zip", True),
    ],
)
def test_download_variants(client, fmt, ctype, zip_flag):
    r = _dl(client, fmt, ["s1", "s2"], zip_flag)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith(ctype)

    if ctype == "application/zip":
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            assert sorted(z.namelist()) == [
                "First." + ("tex" if fmt == "latex" else "pdf"),
                "Second." + ("tex" if fmt == "latex" else "pdf"),
            ]
    else:
        if fmt == "latex":
            assert b"\\documentclass" in r.content
        else:
            assert r.content.startswith(b"%PDF")


def test_zip_individual_summaries(client):
    r = _dl(client, "pdf", ["s1", "s2"], zip_flag=True)
    assert r.status_code == 200
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        names = sorted(z.namelist())
        assert names == ["First.pdf", "Second.pdf"]
        # content isolation
        data = {name: z.read(name) for name in names}
        assert b"First" in data["First.pdf"] and b"Second" not in data["First.pdf"]
        assert b"Second" in data["Second.pdf"] and b"First" not in data["Second.pdf"]


def test_chat_not_found(client, monkeypatch):
    empty = {"chats": [], "summaries": [], "figures": [], "documents": [], "files": []}
    monkeypatch.setattr(droute, "get_supabase", lambda: FakeSupabase(empty))
    assert _dl(client, "pdf", ["s1"]).status_code == 404


def test_summaries_not_found(client, monkeypatch):
    tables = {
        "chats": [{"id": "chat1", "class": "c", "name": "C"}],
        "summaries": [],
        "figures": [],
        "documents": [],
        "files": [],
    }
    monkeypatch.setattr(droute, "get_supabase", lambda: FakeSupabase(tables))
    r = _dl(client, "pdf", ["nope"])
    assert r.status_code == 404 and r.json()["detail"] == "Summaries not found"


def test_invalid_format(client):
    assert _dl(client, "text", ["s1"]).status_code == 422


def test_missing_params(client):
    r = client.get("/download/summary", params={"chat_id": "chat1", "format": "pdf"})
    assert r.status_code == 422
