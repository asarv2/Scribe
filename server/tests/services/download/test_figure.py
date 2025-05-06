# tests/test_figure.py
import io
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image  # type: ignore

# ---------------------------------------------------------------------
# import the code under test
# ---------------------------------------------------------------------
import app.routes.download_route as download_mod  # contains endpoint
import app.services.download.figures as fig_mod  # FigureDownloader


# ---------------------------------------------------------------------
# helpers / fakes
# ---------------------------------------------------------------------
@pytest.fixture(scope="session")
def png_bytes():
    """1x1 transparent PNG as bytes."""
    buf = io.BytesIO()
    Image.new("RGBA", (1, 1), (0, 0, 0, 0)).save(buf, format="PNG")
    return buf.getvalue()


class _FakeResult:
    """Mimics Supabase .execute().data behaviour."""

    def __init__(self, data):
        self.data = data


class FakeSupabase:
    """Very small stub that understands the chained table()...execute()."""

    def __init__(self, chats, figures):
        self._tables = {"chats": chats, "figures": figures}

    def table(self, name):
        self._current = self._tables[name]
        return self

    def select(self, *_a, **_kw):
        return self

    # eq / in_ both return self while recording the filter ----------------
    def eq(self, field, value):
        self._current = [r for r in self._current if r[field] == value]
        return self

    def in_(self, field, values):
        self._current = [r for r in self._current if r[field] in values]
        return self

    def execute(self):
        return _FakeResult(self._current)


# ---------------------------------------------------------------------
# common fixtures
# ---------------------------------------------------------------------
@pytest.fixture()
def tmp_dirs(monkeypatch, tmp_path):
    """Redirect FIGURES_DIR to a temp folder for every test."""
    monkeypatch.setattr(download_mod, "FIGURES_DIR", tmp_path, raising=False)
    monkeypatch.setattr(fig_mod, "FIGURES_DIR", tmp_path, raising=False)
    return tmp_path


@pytest.fixture()
def client(monkeypatch, png_bytes, tmp_dirs):
    """TestClient with *all* externals monkey‑patched."""
    # 1) fake Supabase ----------------------------------------------
    chats = [{"id": "chat1", "class": "classA", "name": "Chat"}]
    figures = [
        {  # single very small figure
            "id": "fig1",
            "title": "Tiny",
            "code": r"\begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}",
            "references": [],
        },
        {  # second figure for multi‑zip tests
            "id": "fig2",
            "title": "Tiny-2",
            "code": r"\begin{tikzpicture}\draw (0,1)--(1,0);\end{tikzpicture}",
            "references": [],
        },
    ]
    monkeypatch.setattr(
        download_mod,
        "get_supabase",
        lambda: FakeSupabase(chats, figures),
    )

    # 2) kill network in FigureDownloader ---------------------------
    async def fake_fetch_png(self, class_id, fig_id):
        return png_bytes

    monkeypatch.setattr(
        fig_mod.FigureDownloader, "_fetch_png", fake_fetch_png, raising=True
    )

    # 3) short‑circuit LaTeX compile so combine_pdf just writes stub
    def fake_combine_pdf(self):
        outfile = Path(tmp_dirs) / self.figures[0]["id"] / "combined.pdf"
        outfile.parent.mkdir(parents=True, exist_ok=True)
        outfile.write_bytes(b"%PDF-1.4\n%stub\n")
        return str(outfile), "combined.pdf"

    monkeypatch.setattr(fig_mod.FigureDownloader, "combine_pdf", fake_combine_pdf)

    from app.main import app  # your FastAPI entry‑point

    return TestClient(app)


# ---------------------------------------------------------------------
# tests
# ---------------------------------------------------------------------
def _call(client, fmt, ids, zip=False):
    params = {
        "chat_id": "chat1",
        "figure_ids": ids,
        "format": fmt,
        "zip": str(zip).lower(),
    }
    return client.get("/download/figure", params=params)


def test_single_png(client):
    r = _call(client, "png", ["fig1"])
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/png")
    assert r.headers["content-disposition"].endswith("combined.png")
    # quick sanity: PNG header
    assert r.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_multi_png_zip(client):
    r = _call(client, "png", ["fig1", "fig2"], zip=True)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/zip"
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        names = sorted(z.namelist())
        assert names == ["Tiny.png", "Tiny_2.png"]
        assert all(z.read(n)[:8] == b"\x89PNG\r\n\x1a\n" for n in names)


def test_single_latex(client):
    r = _call(client, "latex", ["fig1"])
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/x-tex")
    assert rb"\documentclass" in r.content
    assert rb"Tiny" in r.content


def test_multi_latex_zip(client):
    r = _call(client, "latex", ["fig1", "fig2"], zip=True)
    assert r.status_code == 200
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        assert sorted(z.namelist()) == ["Tiny.tex", "Tiny_2.tex"]


def test_pdf(client):
    r = _call(client, "pdf", ["fig1"])
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")


def test_chat_not_found(client, monkeypatch):
    # monkey‑patch get_supabase to return empty chats list
    bad_supabase = FakeSupabase([], [])
    monkeypatch.setattr(download_mod, "get_supabase", lambda: bad_supabase)
    r = _call(client, "png", ["fig1"])
    assert r.status_code == 404


@pytest.mark.parametrize(
    "fmt,ids,ctype,zip_flag",
    [
        ("png", ["fig1", "fig2"], "image/png", False),  # grid combine
        ("latex", ["fig1", "fig2"], "application/x-tex", False),
        ("pdf", ["fig1", "fig2"], "application/pdf", False),
    ],
)
def test_multi_combine_no_zip(client, fmt, ids, ctype, zip_flag):
    r = _call(client, fmt, ids, zip=zip_flag)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith(ctype)
    if fmt == "png":
        # combined sprite sheet PNG
        assert r.content[:8] == b"\x89PNG\r\n\x1a\n"
    elif fmt == "latex":
        # one \begin{figure} per snippet
        assert r.content.count(b"\\begin{figure}") == len(ids)
    elif fmt == "pdf":
        assert r.content.startswith(b"%PDF")


def test_figures_not_found(client, monkeypatch):
    empty = FakeSupabase(
        chats=[{"id": "chat1", "class": "classA", "name": "Chat"}],
        figures=[],  # <— no matching figures
    )
    monkeypatch.setattr(download_mod, "get_supabase", lambda: empty)
    r = _call(client, "png", ["does-not-exist"])
    assert r.status_code == 404
    assert r.json()["detail"] == "Figures not found"


def test_invalid_format(client):
    r = _call(client, "svg", ["fig1"])  # unsupported format
    assert r.status_code == 422


def test_missing_required_params(client):
    # omit 'figure_ids' completely
    r = client.get("/download/figure", params={"chat_id": "chat1", "format": "png"})
    assert r.status_code == 422  # FastAPI validation error


def test_pdf_with_zip_true_still_returns_pdf(client):
    r = _call(client, "pdf", ["fig1"], zip=True)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
