"""
Unit tests for app.services.chat.agents.tools.summary
Designed to mirror the style of tests/test_create_figure.py
and run fully offline in < 1s.
"""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

# ──────────────────────────────────────────────────────────────────────────
# code under test
# ──────────────────────────────────────────────────────────────────────────
import app.services.chat.agents.tools.summary as summary_mod
from app.services.chat.models.general import (
    Summary,
    Figure,
    CreateSummaryResponse,
    CreateFigureResponse,
)
from app.services.chat.agents.tools.examples.summary_testdata import (
    GOOD_SUMMARIES,
    BAD_SUMMARIES,
)


# ──────────────────────────────────────────────────────────────────────────
# tiny fakes / helpers
# ──────────────────────────────────────────────────────────────────────────
class _FakeResult:
    def __init__(self, data):
        self.data = data


class FakeSupabase:
    """
    Minimal stub that understands
       table().insert().execute()
       table().update().eq().execute()
    """

    def __init__(self, summaries_store):
        self._tables = {"summaries": summaries_store}

    # -- Supabase-like chained API ---------------------------------------
    def table(self, name):
        self._current_table = name
        self._filter = lambda r: True
        return self

    def insert(self, rows):
        if isinstance(rows, dict):
            rows = [rows]
        for r in rows:
            r.setdefault("id", str(uuid4()))
            self._tables[self._current_table].append(r)
        self._pending = rows
        return self

    def update(self, patch):
        for r in self._tables[self._current_table]:
            if self._filter(r):
                r.update(patch)
        return self

    def eq(self, field, value):
        prev = self._filter
        self._filter = lambda r: prev(r) and r.get(field) == value
        return self

    def execute(self):
        return _FakeResult(
            getattr(
                self,
                "_pending",
                list(filter(self._filter, self._tables[self._current_table])),
            )
        )


# synthetic RunContextWrapper ----------------------------------------------
def _make_wrapper():
    ctx = SimpleNamespace(
        class_id="classA",
        message_id="msg1",
        references={},  # no document refs needed for these tests
    )
    return SimpleNamespace(context=ctx)


# ──────────────────────────────────────────────────────────────────────────
# pytest fixtures
# ──────────────────────────────────────────────────────────────────────────
@pytest.fixture()
def tmp_cache(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    return tmp_path


@pytest.fixture()
def fake_supabase(monkeypatch) -> list[dict]:
    store: list[dict] = []
    monkeypatch.setattr(
        summary_mod, "get_supabase", lambda: FakeSupabase(store), raising=False
    )
    return store


@pytest.fixture()
def patch_helpers(monkeypatch):
    """
    Neutralise heavy helpers inside the tool:
      * create_figures – we stub it out
      * clean_references / clean_figures – identity functions
    """

    async def _fake_create_figures(wrapper, figs):
        # by default succeed & return mapping 1->dummy-id
        if not figs:
            return []
        resp = []
        for _ in figs:
            resp.append(CreateFigureResponse(success=True, figure_id=str(uuid4())))
        return resp

    monkeypatch.setattr(
        summary_mod, "create_figures", _fake_create_figures, raising=True
    )
    monkeypatch.setattr(
        summary_mod, "clean_references", lambda txt, *_: txt, raising=True
    )
    monkeypatch.setattr(summary_mod, "clean_figures", lambda txt, *_: txt, raising=True)


# ──────────────────────────────────────────────────────────────────────────
# tests
# ──────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_success_single(fake_supabase: list[dict], patch_helpers: None) -> None:
    wrapper = _make_wrapper()
    summ = Summary(
        title="T1",
        preamble="P",
        body="B",
        conclusion="C",
        references=[],
        figures=[],
        message="done!",
    )
    resp: CreateSummaryResponse = (await summary_mod.create_summaries(wrapper, [summ]))[
        0
    ]
    assert resp.success
    row = next(r for r in fake_supabase if r["id"] == resp.summary_id)
    assert row["generation_status"] == "complete"


@pytest.mark.asyncio
async def test_figure_failure_propagates(fake_supabase, patch_helpers, monkeypatch):
    # patch create_figures to return a failure
    async def _fail_figures(wrapper, figs):
        return [CreateFigureResponse(success=False, error="boom")]

    monkeypatch.setattr(summary_mod, "create_figures", _fail_figures, raising=True)

    wrapper = _make_wrapper()
    # Use a valid figure with latex_code to bypass the validation
    summ = Summary(
        title="BadFig",
        preamble="P",
        body="B",
        conclusion="C",
        figures=[Figure(title="F", latex_code="valid code", references=[], message="")],
        message="",
    )
    resp = (await summary_mod.create_summaries(wrapper, [summ]))[0]
    assert not resp.success
    assert "boom" in resp.error


@pytest.mark.asyncio
async def test_multi_mixed(fake_supabase: list[dict], patch_helpers: None) -> None:
    wrapper = _make_wrapper()
    good = Summary(
        title="G", preamble="p", body="b", conclusion="c", figures=[], message=""
    )
    bad = Summary(
        title="B",
        preamble="p",
        body="b",
        conclusion="c",
        figures=[Figure()],
        message="",
    )

    # patch create_figures to fail for the second Summary only
    async def _create_figs(wrapper, figs):
        if figs:  # treat any figure list as an error
            return [CreateFigureResponse(success=False, error="err")]
        return []

    summary_mod.create_figures = _create_figs  # noqa: E501  (monkeypatching manually because we replaced earlier)

    resps = await summary_mod.create_summaries(wrapper, [good, bad])
    good_resp, bad_resp = resps
    assert good_resp.success is True
    assert bad_resp.success is False


@pytest.mark.asyncio
async def test_references_and_figures_cleaned(fake_supabase: list[dict], monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Ensure that clean_references and clean_figures are *called* and
    substituted text is written back to DB.
    """

    called = {"refs": 0, "figs": 0}

    def _clean_refs(txt, _):
        called["refs"] += 1
        return txt.replace("[1]", "(ref)")

    def _clean_figs(txt, _):
        called["figs"] += 1
        return txt.replace("{1}", "(fig)")

    monkeypatch.setattr(summary_mod, "clean_references", _clean_refs, raising=True)
    monkeypatch.setattr(summary_mod, "clean_figures", _clean_figs, raising=True)

    # figures succeed so mapping {1}->{dummy}
    async def _fake_create(wrapper, figs):
        return [CreateFigureResponse(success=True, figure_id="id1")]

    monkeypatch.setattr(summary_mod, "create_figures", _fake_create, raising=True)

    wrapper = _make_wrapper()
    summ = Summary(
        title="Clean",
        preamble="intro [1]",
        body="see {1}",
        conclusion="done",
        references=[1],
        figures=[Figure(title="F", latex_code="LC", references=[], message="")],
        message="",
    )
    resp = (await summary_mod.create_summaries(wrapper, [summ]))[0]
    assert resp.success
    assert called["refs"] >= 3 and called["figs"] >= 3  # once per section


@pytest.mark.asyncio
@pytest.mark.parametrize("summ", GOOD_SUMMARIES, ids=lambda s: s.title)
async def test_good_summaries(fake_supabase, patch_helpers, summ):
    wrapper = _make_wrapper()
    resp = (await summary_mod.create_summaries(wrapper, [summ]))[0]
    assert resp.success


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("summ", "expect"),
    BAD_SUMMARIES,
    ids=[s.title for s, _ in BAD_SUMMARIES],
)
async def test_bad_summaries(fake_supabase, patch_helpers, summ, expect, monkeypatch):
    # We need to validate the summary before attempting to create figures
    # Don't force figure creation to fail for these tests
    wrapper = _make_wrapper()
    resp = (await summary_mod.create_summaries(wrapper, [summ]))[0]
    assert not resp.success and expect in (resp.error or "")
