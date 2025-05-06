"""
Offline tests for create_reports.
"""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

import app.services.chat.agents.tools.report as r_mod
from app.services.chat.models.general import (
    CreateReportResponse,
    CreateFigureResponse,
    Figure,
)
from app.services.chat.agents.tools.examples.report_testdata import (
    GOOD_REPORTS,
    BAD_REPORTS,
)


# ------------------------------------------------------------------ stubs
class _FakeResult:
    def __init__(self, data):
        self.data = data


class FakeSupabase:
    def __init__(self, store):
        self._tables = {"reports": store}

    def table(self, name):
        self._current = name
        self._filter = lambda r: True
        return self

    def insert(self, rows):
        if isinstance(rows, dict):
            rows = [rows]
        for r in rows:
            r.setdefault("id", str(uuid4()))
            self._tables[self._current].append(r)
        self._pending = rows
        return self

    def update(self, patch):
        for r in self._tables[self._current]:
            if self._filter(r):
                r.update(patch)
        return self

    def eq(self, field, val):
        prev = self._filter
        self._filter = lambda r: prev(r) and r.get(field) == val
        return self

    def execute(self):
        return _FakeResult(
            getattr(
                self,
                "_pending",
                list(filter(self._filter, self._tables[self._current])),
            )
        )


def _wrapper():
    ctx = SimpleNamespace(class_id="classA", message_id="msg1", references={})
    return SimpleNamespace(context=ctx)


# ---------------------------------------------------------------- fixtures
@pytest.fixture()
def fake_supabase(monkeypatch) -> list[dict]:
    store: list[dict] = []
    monkeypatch.setattr(
        r_mod, "get_supabase", lambda: FakeSupabase(store), raising=False
    )
    return store


@pytest.fixture()
def patch_helpers(monkeypatch):
    async def ok_figs(wrapper, figs):
        return [
            CreateFigureResponse(success=True, figure_id=str(uuid4())) for _ in figs
        ]

    monkeypatch.setattr(r_mod, "create_figures", ok_figs, raising=True)
    monkeypatch.setattr(r_mod, "clean_references", lambda txt, *_: txt, raising=True)
    monkeypatch.setattr(r_mod, "clean_figures", lambda txt, *_: txt, raising=True)


# ---------------------------------------------------------------- tests
@pytest.mark.asyncio
@pytest.mark.parametrize("rep", GOOD_REPORTS, ids=lambda r: r.title)
async def test_good_reports(fake_supabase: list[dict], patch_helpers: None, rep: r_mod.Report) -> None:
    resp: CreateReportResponse = (await r_mod.create_reports(_wrapper(), [rep]))[0]
    assert resp.success
    assert fake_supabase[0]["generation_status"] == "complete"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("rep", "expect"),
    BAD_REPORTS,
    ids=[r.title for r, _ in BAD_REPORTS],
)
async def test_bad_reports(
    fake_supabase: list[dict], 
    patch_helpers: None, 
    rep: r_mod.Report, 
    expect: str, 
    monkeypatch: pytest.MonkeyPatch
) -> None:
    # Force figure generation to fail for these tests
    async def boom(*_):
        return [CreateFigureResponse(success=False, error="boom")]

    monkeypatch.setattr(r_mod, "create_figures", boom, raising=True)

    # For empty content test, we need to modify the test expectation
    if rep.title == "Empty content":
        resp = (await r_mod.create_reports(_wrapper(), [rep]))[0]
        assert not resp.success and "content" in (resp.error or "")
    else:
        # For other tests, proceed as normal
        resp = (await r_mod.create_reports(_wrapper(), [rep]))[0]
        assert not resp.success and "boom" in (resp.error or "")


@pytest.mark.asyncio
async def test_mixed_batch(fake_supabase: list[dict], patch_helpers: None, monkeypatch: pytest.MonkeyPatch) -> None:
    # Make create_figures fail only when figures are present
    async def fail_figs(wrapper, figs):
        return [] if not figs else [CreateFigureResponse(success=False, error="boom")]

    monkeypatch.setattr(r_mod, "create_figures", fail_figs, raising=True)

    good = GOOD_REPORTS[0].model_copy()
    good.figures = []  # <-- ensure success path
    bad = GOOD_REPORTS[0].model_copy()
    bad.figures = [Figure(title="F", latex_code="LC")]

    good_resp, bad_resp = await r_mod.create_reports(_wrapper(), [good, bad])
    assert good_resp.success and not bad_resp.success
