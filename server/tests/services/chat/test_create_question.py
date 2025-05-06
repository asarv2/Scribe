"""
Offline tests for app.services.chat.agents.tools.question
Style intentionally matches test_create_figure.py / test_create_summary.py.
"""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

import app.services.chat.agents.tools.question as q_mod
from app.services.chat.models.general import (
    CreateFigureResponse,
    Figure,
)
from app.services.chat.agents.tools.examples.question_testdata import (
    GOOD_QUESTIONS,
    BAD_QUESTIONS,
)


# ──────────────────────────────────────────────────────────────────────────
# fake Supabase (only 'questions' table used)
# ──────────────────────────────────────────────────────────────────────────
class _FakeResult:
    def __init__(self, data):
        self.data = data


class FakeSupabase:
    def __init__(self, store):
        self._tables = {"questions": store}

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


# synthetic RunContextWrapper ----------------------------------------------
def _wrapper():
    ctx = SimpleNamespace(class_id="classA", message_id="msg1", references={})
    return SimpleNamespace(context=ctx)


# ──────────────────────────────────────────────────────────────────────────
# pytest fixtures
# ──────────────────────────────────────────────────────────────────────────
@pytest.fixture()
def fake_supabase(monkeypatch) -> list[dict]:
    store: list[dict] = []
    monkeypatch.setattr(
        q_mod, "get_supabase", lambda: FakeSupabase(store), raising=False
    )
    return store


@pytest.fixture()
def patch_helpers(monkeypatch):
    """Neutralise create_figures; succeed by default."""

    async def _ok_create_figures(wrapper, figs):
        return [
            CreateFigureResponse(success=True, figure_id=str(uuid4())) for _ in figs
        ]

    monkeypatch.setattr(q_mod, "create_figures", _ok_create_figures, raising=True)


# ──────────────────────────────────────────────────────────────────────────
# tests
# ──────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_good_examples(fake_supabase: list[dict], patch_helpers: None) -> None:
    wrapper = _wrapper()
    resps = await q_mod.create_questions(wrapper, GOOD_QUESTIONS)
    assert all(r.success for r in resps)
    assert len(fake_supabase) == len(GOOD_QUESTIONS)
    # every stored row marked complete
    assert all(r["generation_status"] == "complete" for r in fake_supabase)


@pytest.mark.asyncio
async def test_figure_failure_propagates(fake_supabase, patch_helpers, monkeypatch):
    async def _fail(wrapper, figs):
        return [CreateFigureResponse(success=False, error="boom")]

    monkeypatch.setattr(q_mod, "create_figures", _fail, raising=True)

    wrapper = _wrapper()
    bad_fig_q = GOOD_QUESTIONS[0].model_copy()
    bad_fig_q.figures = [Figure(title="F", latex_code="LC")]
    resp = (await q_mod.create_questions(wrapper, [bad_fig_q]))[0]
    assert not resp.success and "boom" in resp.error


@pytest.mark.asyncio
async def test_bad_examples(fake_supabase, patch_helpers, monkeypatch):
    # Force figure generation to fail for these tests
    async def boom(*_):
        return [CreateFigureResponse(success=False, error="boom")]

    monkeypatch.setattr(q_mod, "create_figures", boom, raising=True)

    wrapper = _wrapper()
    for q_obj, expect in BAD_QUESTIONS:
        resp = (await q_mod.create_questions(wrapper, [q_obj]))[0]
        assert not resp.success
        assert "boom" in (resp.error or "")


@pytest.mark.asyncio
async def test_mixed_batch(fake_supabase: list[dict], patch_helpers: None, monkeypatch: pytest.MonkeyPatch) -> None:
    # cause create_figures to fail only when figures are present
    async def _fail(wrapper, figs):
        return [] if not figs else [CreateFigureResponse(success=False, error="x")]

    monkeypatch.setattr(q_mod, "create_figures", _fail, raising=True)

    wrapper = _wrapper()
    good = GOOD_QUESTIONS[0]
    bad = GOOD_QUESTIONS[0].model_copy()
    bad.figures = [Figure(title="F", latex_code="LC")]

    good_resp, bad_resp = await q_mod.create_questions(wrapper, [good, bad])
    assert good_resp.success and not bad_resp.success
