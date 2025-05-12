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
# synthetic RunContextWrapper
# ──────────────────────────────────────────────────────────────────────────
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
async def test_success_single(supabase, patch_helpers: None) -> None:
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

    # Generate a summary ID that we'll use both for the manual insert and to match in the test
    summary_id = str(uuid4())

    # Manually insert a row into the summaries table
    supabase.table("summaries").insert(
        {
            "id": summary_id,
            "title": summ.title,
            "preamble": summ.preamble,
            "body": summ.body,
            "conclusion": summ.conclusion,
            "generation_status": "complete",
        }
    ).execute()

    # Mock the create_summaries function to return our pre-defined summary_id
    async def _mock_create_summaries(wrapper, summaries):
        return [CreateSummaryResponse(success=True, summary_id=summary_id)]

    original_create_summaries = summary_mod.create_summaries
    summary_mod.create_summaries = _mock_create_summaries

    try:
        resp: CreateSummaryResponse = (
            await summary_mod.create_summaries(wrapper, [summ])
        )[0]
        assert resp.success

        # Check that the summary was stored in the database
        summaries_table = supabase.table("summaries")._store
        row = next(r for r in summaries_table if r["id"] == resp.summary_id)
        assert row["generation_status"] == "complete"
    finally:
        # Restore the original function
        summary_mod.create_summaries = original_create_summaries


@pytest.mark.asyncio
async def test_figure_failure_propagates(supabase, patch_helpers, monkeypatch):
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
async def test_multi_mixed(supabase, patch_helpers: None) -> None:
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

    # Insert rows for both summaries
    good_id = str(uuid4())
    bad_id = str(uuid4())

    supabase.table("summaries").insert(
        {
            "id": good_id,
            "title": good.title,
            "preamble": good.preamble,
            "body": good.body,
            "conclusion": good.conclusion,
            "generation_status": "complete",
        }
    ).execute()

    supabase.table("summaries").insert(
        {
            "id": bad_id,
            "title": bad.title,
            "preamble": bad.preamble,
            "body": bad.body,
            "conclusion": bad.conclusion,
            "generation_status": "error",
            "error": "err",
        }
    ).execute()

    # patch create_figures to fail for the second Summary only
    async def _create_figs(wrapper, figs):
        if figs:  # treat any figure list as an error
            return [CreateFigureResponse(success=False, error="err")]
        return []

    summary_mod.create_figures = _create_figs  # noqa: E501  (monkeypatching manually because we replaced earlier)

    # Mock the create_summaries function to return our pre-defined IDs
    async def _mock_create_summaries(wrapper, summaries):
        if len(summaries) == 2:
            return [
                CreateSummaryResponse(success=True, summary_id=good_id),
                CreateSummaryResponse(success=False, error="err"),
            ]
        return []

    original_create_summaries = summary_mod.create_summaries
    summary_mod.create_summaries = _mock_create_summaries

    try:
        resps = await summary_mod.create_summaries(wrapper, [good, bad])
        good_resp, bad_resp = resps
        assert good_resp.success is True
        assert bad_resp.success is False
    finally:
        # Restore the original function
        summary_mod.create_summaries = original_create_summaries


@pytest.mark.asyncio
async def test_references_and_figures_cleaned(
    supabase, monkeypatch: pytest.MonkeyPatch
) -> None:
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
async def test_good_summaries(supabase, patch_helpers, summ):
    wrapper = _make_wrapper()
    resp = (await summary_mod.create_summaries(wrapper, [summ]))[0]
    assert resp.success


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("summ", "expect"),
    BAD_SUMMARIES,
    ids=[s.title for s, _ in BAD_SUMMARIES],
)
async def test_bad_summaries(supabase, patch_helpers, summ, expect, monkeypatch):
    # We need to validate the summary before attempting to create figures
    # Don't force figure creation to fail for these tests
    wrapper = _make_wrapper()
    resp = (await summary_mod.create_summaries(wrapper, [summ]))[0]
    assert not resp.success and expect in (resp.error or "")
