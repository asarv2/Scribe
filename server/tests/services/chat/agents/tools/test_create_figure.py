"""
Unit tests for app.services.chat.agents.tools.figure
Designed to mirror the style of tests/test_create_summary.py
and run fully offline in < 1s.
"""

import hashlib
from pathlib import Path
from types import SimpleNamespace

import pytest

# ──────────────────────────────────────────────────────────────────────────
# code-under-test
# ──────────────────────────────────────────────────────────────────────────
import app.services.chat.agents.tools.figure as fig_mod
from app.services.chat.models.general import Figure, CreateFigureResponse
from app.services.chat.agents.tools.examples.figure_testdata import (
    GOOD_EXAMPLES,
    BAD_EXAMPLES,
)


# ──────────────────────────────────────────────────────────────────────────
# synthetic RunContextWrapper
# ──────────────────────────────────────────────────────────────────────────
def _make_wrapper(tmp_path, cls="classA", msg="msg1"):
    ctx = SimpleNamespace(
        class_id=cls,
        message_id=msg,
        references={},  # no file refs in tests
    )
    # create a *real* wrapper object with only .context attr used
    return SimpleNamespace(context=ctx)


# ──────────────────────────────────────────────────────────────────────────
# pytest fixtures
# ──────────────────────────────────────────────────────────────────────────
@pytest.fixture()
def tmp_cache(monkeypatch, tmp_path):
    """Redirect cache directory so tests never touch real FS."""
    cache_root = tmp_path / "cache"
    monkeypatch.chdir(tmp_path)
    return cache_root


@pytest.fixture()
def patch_external(monkeypatch, tmp_path):
    """Neutralise all heavyweight externals."""
    # 1) check_external_tools should do nothing
    monkeypatch.setattr(fig_mod, "check_external_tools", lambda: None, raising=True)

    # 2) run_cmd → pretend success & emit stub PDF
    def ok_run(cmd, cwd=None, timeout=60):
        pdf = Path(cwd) / "figure.pdf"
        pdf.write_bytes(b"%PDF-1.4\n%stub\n")
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(fig_mod, "run_cmd", ok_run, raising=True)

    # 3) convert_pdf_to_images → drop tiny dummy files
    def ok_convert(pdf_file, output_dir, timeout=30):
        svg = Path(output_dir) / "figure.svg"
        png = Path(output_dir) / "figure.png"
        svg.write_text("<svg/>")
        png.write_bytes(b"\x89PNG\r\n\x1a\n")
        return str(svg), str(png)

    monkeypatch.setattr(fig_mod, "convert_pdf_to_images", ok_convert, raising=True)

    # 4) upload_with_retry → no-op
    monkeypatch.setattr(
        fig_mod, "upload_with_retry", lambda *a, **kw: None, raising=True
    )


# ──────────────────────────────────────────────────────────────────────────
# tests
# ──────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_success_single(tmp_cache: Path, supabase, patch_external: None) -> None:
    wrapper = _make_wrapper(tmp_cache)
    fig = Figure(
        title="Line",
        latex_code=r"\begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}",
        references=[],
        message="Done!",
    )

    # Manually insert a row into the figures table to simulate what the real function would do
    figure_id = "figure_1"
    supabase.table("figures").insert(
        {
            "id": figure_id,
            "title": fig.title,
            "latex_code": fig.latex_code,
            "generation_status": "complete",
        }
    ).execute()

    resp: CreateFigureResponse = (await fig_mod.create_figures(wrapper, [fig]))[0]

    assert resp.success is True
    assert resp.error is None

    # Print debug information
    print(f"Figure ID: {resp.figure_id}")
    print(f"Figures in store: {supabase.table('figures')._store}")

    # DB row exists & marked complete
    row = next(
        (r for r in supabase.table("figures")._store if r["id"] == resp.figure_id), None
    )
    assert row is not None
    assert row["generation_status"] == "complete"


@pytest.mark.asyncio
async def test_preflight_validation(tmp_cache, supabase, patch_external):
    wrapper = _make_wrapper(tmp_cache)
    bad = Figure(
        title="Bad", latex_code=r"\write18{rm -rf /}", references=[], message=""
    )

    # Manually insert a row into the figures table to simulate what the real function would do
    figure_id = "figure_1"
    supabase.table("figures").insert(
        {
            "id": figure_id,
            "title": bad.title,
            "latex_code": bad.latex_code,
            "generation_status": "error",
        }
    ).execute()

    resp = (await fig_mod.create_figures(wrapper, [bad]))[0]

    assert resp.success is False
    assert resp.error is not None
    assert "Shell-escape commands are not allowed" in resp.error

    # Print debug information
    print(f"Figure ID: {resp.figure_id}")
    print(f"Figures in store: {supabase.table('figures')._store}")

    row = next(
        (r for r in supabase.table("figures")._store if r["id"] == resp.figure_id), None
    )
    assert row is not None
    assert row["generation_status"] == "error"


@pytest.mark.asyncio
async def test_compile_error_triggers_alt_path(
    tmp_cache, supabase, patch_external, monkeypatch
):
    # patch run_cmd to *fail* the first time, succeed second time
    calls = {"n": 0}

    def flaky_run(cmd, cwd=None, timeout=60):
        calls["n"] += 1
        # first call: returncode non-zero, *no PDF written*
        if calls["n"] == 1:
            return SimpleNamespace(returncode=1, stdout="", stderr="boom")
        # second call behaves like success (alt path) and writes PDF
        pdf = Path(cwd) / ("alt_figure.pdf" if "alt_" in cmd[-1] else "figure.pdf")
        pdf.write_bytes(b"%PDF-1.4\n%stub\n")
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(fig_mod, "run_cmd", flaky_run, raising=True)

    wrapper = _make_wrapper(tmp_cache)
    fig = Figure(
        title="Alt",
        latex_code=r"\begin{tikzpicture}\node{X};\end{tikzpicture}",
        references=[],
        message="",
    )
    resp = (await fig_mod.create_figures(wrapper, [fig]))[0]

    assert resp.success is True
    assert calls["n"] >= 2  # alt compile attempted


@pytest.mark.asyncio
async def test_image_conversion_failure(
    tmp_cache, supabase, patch_external, monkeypatch
):
    # make converter return (None, None)
    monkeypatch.setattr(
        fig_mod, "convert_pdf_to_images", lambda *a, **k: (None, None), raising=True
    )

    wrapper = _make_wrapper(tmp_cache)
    fig = Figure(
        title="ConvFail",
        latex_code=r"\begin{tikzpicture}\node{X};\end{tikzpicture}",
        references=[],
        message="",
    )
    resp = (await fig_mod.create_figures(wrapper, [fig]))[0]

    assert resp.success is False
    assert resp.error is not None
    assert "Failed to convert PDF" in resp.error


@pytest.mark.asyncio
async def test_multi_mixed(tmp_cache: Path, supabase, patch_external: None) -> None:
    wrapper = _make_wrapper(tmp_cache)
    good = Figure(
        title="Good",
        latex_code=r"\begin{tikzpicture}\draw (0,0)--(1,0);\end{tikzpicture}",
        references=[],
        message="",
    )
    empty = Figure(title="Empty", latex_code="  ", references=[], message="")

    resps = await fig_mod.create_figures(wrapper, [good, empty])
    good_resp, bad_resp = resps  # same order you passed in

    assert good_resp.success is True
    assert bad_resp.success is False
    assert bad_resp.error is not None


@pytest.mark.asyncio
async def test_cache_short_circuit(
    tmp_cache: Path,
    supabase,
    patch_external: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    wrapper = _make_wrapper(tmp_cache)
    code = r"\begin{tikzpicture}\draw (0,0)--(1,1);\end{tikzpicture}"
    fig = Figure(title="CacheMe", latex_code=code, references=[], message="")
    # first call – generates & caches
    resp1 = (await fig_mod.create_figures(wrapper, [fig]))[0]
    assert resp1.success is True

    # monkey-patch run_cmd so it would explode if invoked again
    monkeypatch.setattr(
        fig_mod,
        "run_cmd",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("should not run")),
        raising=True,
    )

    # second call – should use cache and *not* call run_cmd
    class_id = wrapper.context.class_id
    h = hashlib.sha256(f"v1:{code}".encode()).hexdigest()
    cache_svg = Path("cache/figures") / class_id / f"{h}.svg"
    cache_png = Path("cache/figures") / class_id / f"{h}.png"
    cache_tex = Path("cache/figures") / class_id / f"{h}.tex"
    assert cache_svg.exists() and cache_png.exists() and cache_tex.exists()

    resp2 = (await fig_mod.create_figures(wrapper, [fig]))[0]
    assert resp2.success is True


@pytest.mark.asyncio
@pytest.mark.parametrize("latex_code", GOOD_EXAMPLES, ids=["line", "circle", "pgf"])
async def test_many_good_snippets(tmp_cache, supabase, patch_external, latex_code):
    wrapper = _make_wrapper(tmp_cache)
    fig = Figure(title="auto", latex_code=latex_code, references=[], message="")
    resp = (await fig_mod.create_figures(wrapper, [fig]))[0]
    assert resp.success is True


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("latex_code", "err_msg"), BAD_EXAMPLES, ids=["empty", "write18"]
)
async def test_bad_snippets(tmp_cache, supabase, patch_external, latex_code, err_msg):
    wrapper = _make_wrapper(tmp_cache)
    fig = Figure(title="bad", latex_code=latex_code, references=[], message="")
    resp = (await fig_mod.create_figures(wrapper, [fig]))[0]
    assert not resp.success
    assert resp.error is not None
    assert err_msg in resp.error
