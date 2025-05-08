# tests/test_figure.py
from __future__ import annotations

import io
import zipfile
from pathlib import Path
import os

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import app.routes.download_route as download_mod
import app.services.download.figures as fig_mod
from app.main import app


# ───────────────────────── fixtures ──────────────────────────
@pytest.fixture(scope="session")
def png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGBA", (1, 1), (0, 0, 0, 0)).save(buf, "PNG")
    return buf.getvalue()


class FakeSupabase:
    def __init__(self, chats, figures):
        self._tables = {"chats": chats, "figures": figures}

    # supabase-like query chain (table → select → eq / in_ → execute)
    def table(self, name):
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

    def execute(self):  # returns .data
        return type("R", (), {"data": self._cur})()


@pytest.fixture()
def client(monkeypatch, tmp_path: Path, png_bytes: bytes) -> TestClient:
    # temp FIGURES_DIR
    monkeypatch.setattr(download_mod, "FIGURES_DIR", tmp_path, False)
    monkeypatch.setattr(fig_mod, "FIGURES_DIR", tmp_path, False)

    # fake DB rows
    chats = [{"id": "chat1", "class": "classA", "name": "Chat"}]
    figures = [
        {
            "id": "fig1",
            "title": "Tiny",
            "code": r"\begin{tikzpicture}...\end{tikzpicture}",
            "references": [],
        },
        {
            "id": "fig2",
            "title": "Tiny-2",
            "code": r"\begin{tikzpicture}...\end{tikzpicture}",
            "references": [],
        },
    ]
    monkeypatch.setattr(
        download_mod, "get_supabase", lambda: FakeSupabase(chats, figures)
    )

    # Create async methods that return awaitable results
    async def _fake_fetch_png(_s, _c, _f):
        return png_bytes

    async def _sync_combine_pngs(self, class_id):
        out_dir = self._out_dir()
        path = os.path.join(out_dir, "combined.png")
        # Create a simple test image
        img = Image.new("RGBA", (10, 10), (0, 0, 0, 0))
        img.save(path)
        return path, "combined.png"

    async def _sync_zip_pngs(self, class_id):
        out_dir = self._out_dir()
        path = os.path.join(out_dir, "figures_png.zip")
        with zipfile.ZipFile(path, "w") as zf:
            for fig in self.figures:
                img_data = io.BytesIO()
                Image.new("RGBA", (1, 1), (0, 0, 0, 0)).save(img_data, "PNG")
                zf.writestr(self._safe(fig["title"]) + ".png", img_data.getvalue())
        return path, "figures_png.zip"

    monkeypatch.setattr(fig_mod.FigureDownloader, "_fetch_png", _fake_fetch_png)
    monkeypatch.setattr(fig_mod.FigureDownloader, "combine_pngs", _sync_combine_pngs)
    monkeypatch.setattr(fig_mod.FigureDownloader, "zip_pngs", _sync_zip_pngs)

    # short-circuit combine_pdf
    def _fake_pdf(self):
        out = tmp_path / self.figures[0]["id"] / "combined.pdf"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(b"%PDF-1.4\n%stub\n")
        return str(out), "combined.pdf"

    monkeypatch.setattr(
        fig_mod.FigureDownloader, "combine_pdf", _fake_pdf, raising=True
    )
    return TestClient(app)


# ───────────────────────── helpers ──────────────────────────
def _download(client, fmt, ids, zip_flag=False):
    return client.get(
        "/download/figure",
        params={
            "chat_id": "chat1",
            "figure_ids": ids,
            "format": fmt,
            "zip": str(zip_flag).lower(),
        },
    )


# ───────────────────────── tests ──────────────────────────
def test_single_png(client):
    r = _download(client, "png", ["fig1"])
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/png")
    assert r.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_multi_png_zip(client):
    r = _download(client, "png", ["fig1", "fig2"], True)
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        assert sorted(z.namelist()) == ["Tiny.png", "Tiny_2.png"]
        for n in z.namelist():
            assert z.read(n)[:8] == b"\x89PNG\r\n\x1a\n"


def test_single_latex(client):
    r = _download(client, "latex", ["fig1"])
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/x-tex")
    assert b"\\documentclass" in r.content or b"\\begin" in r.content


def test_multi_latex_zip(client):
    r = _download(client, "latex", ["fig1", "fig2"], True)
    assert r.status_code == 200
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        assert sorted(z.namelist()) == ["Tiny.tex", "Tiny_2.tex"]


def test_pdf(client):
    r = _download(client, "pdf", ["fig1"])
    assert r.status_code == 200 and r.content.startswith(b"%PDF")


def test_chat_not_found(client, monkeypatch):
    monkeypatch.setattr(download_mod, "get_supabase", lambda: FakeSupabase([], []))
    assert _download(client, "png", ["fig1"]).status_code == 404


@pytest.mark.parametrize("fmt", ["png", "latex", "pdf"])
def test_multi_combine_no_zip(client, fmt):
    r = _download(client, fmt, ["fig1", "fig2"])
    assert r.status_code == 200
    if fmt == "png":
        assert r.content[:8] == b"\x89PNG\r\n\x1a\n"
    elif fmt == "latex":
        assert r.content.count(b"\\begin{figure}") == 2
    else:
        assert r.content.startswith(b"%PDF")


def test_figures_not_found(client, monkeypatch):
    empty = FakeSupabase([{"id": "chat1", "class": "classA", "name": "Chat"}], [])
    monkeypatch.setattr(download_mod, "get_supabase", lambda: empty)
    r = _download(client, "png", ["nope"])
    assert r.status_code == 404 and r.json()["detail"] == "Figures not found"


def test_invalid_format(client):
    assert _download(client, "svg", ["fig1"]).status_code == 422


def test_missing_params(client):
    r = client.get("/download/figure", params={"chat_id": "chat1", "format": "png"})
    assert r.status_code == 422


def test_pdf_zip_flag_ignored(client):
    r = _download(client, "pdf", ["fig1"], True)
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
