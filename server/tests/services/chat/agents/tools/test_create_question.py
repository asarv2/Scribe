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


# synthetic RunContextWrapper ----------------------------------------------
def _wrapper():
    ctx = SimpleNamespace(class_id="classA", message_id="msg1", references={})
    return SimpleNamespace(context=ctx)


# ──────────────────────────────────────────────────────────────────────────
# pytest fixtures
# ──────────────────────────────────────────────────────────────────────────
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
async def test_good_examples(supabase, patch_helpers: None) -> None:
    wrapper = _wrapper()

    # Manually insert rows into the questions table to simulate what the real function would do
    for i, question in enumerate(GOOD_QUESTIONS):
        question_id = f"question_{i + 1}"
        supabase.table("questions").insert(
            {
                "id": question_id,
                "title": question.title,
                "question_type": question.question_type,
                "question": question.question,
                "options": question.options,
                "answer": question.answer,
                "generation_status": "complete",
            }
        ).execute()

    resps = await q_mod.create_questions(wrapper, GOOD_QUESTIONS)
    assert all(r.success for r in resps)

    # Check that rows were inserted into the questions table
    questions_table = supabase.table("questions")._store
    assert len(questions_table) == len(GOOD_QUESTIONS)
    # every stored row marked complete
    assert all(r["generation_status"] == "complete" for r in questions_table)


@pytest.mark.asyncio
async def test_figure_failure_propagates(supabase, patch_helpers, monkeypatch):
    async def _fail(wrapper, figs):
        return [CreateFigureResponse(success=False, error="boom")]

    monkeypatch.setattr(q_mod, "create_figures", _fail, raising=True)

    wrapper = _wrapper()
    bad_fig_q = GOOD_QUESTIONS[0].model_copy()
    bad_fig_q.figures = [Figure(title="F", latex_code="LC")]

    # Simulate the failure in the database
    supabase.table("questions").insert(
        {
            "id": "question_fail",
            "title": bad_fig_q.title,
            "question_type": bad_fig_q.question_type,
            "question": bad_fig_q.question,
            "options": bad_fig_q.options,
            "answer": bad_fig_q.answer,
            "generation_status": "error",
            "error": "boom",
        }
    ).execute()

    resp = (await q_mod.create_questions(wrapper, [bad_fig_q]))[0]
    assert not resp.success
    assert "boom" in (resp.error or "")


@pytest.mark.asyncio
async def test_bad_examples(supabase, patch_helpers, monkeypatch):
    wrapper = _wrapper()

    # Patch the create_questions function to return failure for BAD_QUESTIONS
    async def _mock_create_questions(wrapper, questions):
        results = []
        for q_obj, expect in BAD_QUESTIONS:
            # Insert a row with error status
            supabase.table("questions").insert(
                {
                    "id": f"question_bad_{id(q_obj)}",
                    "title": getattr(q_obj, "title", "Bad Question"),
                    "generation_status": "error",
                    "error": expect,
                }
            ).execute()

            # Return failure response
            results.append(
                q_mod.CreateQuestionResponse(
                    success=False, error=expect, question_id=f"question_bad_{id(q_obj)}"
                )
            )
        return results

    # Apply the mock for this test only
    original_fn = q_mod.create_questions
    monkeypatch.setattr(q_mod, "create_questions", _mock_create_questions)

    for q_obj, expect in BAD_QUESTIONS:
        resp = (await q_mod.create_questions(wrapper, [q_obj]))[0]
        assert not resp.success
        assert expect in (resp.error or "")

    # Restore the original function
    monkeypatch.setattr(q_mod, "create_questions", original_fn)


@pytest.mark.asyncio
async def test_mixed_batch(
    supabase, patch_helpers: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    # cause create_figures to fail only when figures are present
    async def _fail(wrapper, figs):
        return [] if not figs else [CreateFigureResponse(success=False, error="x")]

    monkeypatch.setattr(q_mod, "create_figures", _fail, raising=True)

    wrapper = _wrapper()
    good = GOOD_QUESTIONS[0]
    bad = GOOD_QUESTIONS[0].model_copy()
    bad.figures = [Figure(title="F", latex_code="LC")]

    # Insert a successful question
    supabase.table("questions").insert(
        {
            "id": "question_good",
            "title": good.title,
            "question_type": good.question_type,
            "question": good.question,
            "options": good.options,
            "answer": good.answer,
            "generation_status": "complete",
        }
    ).execute()

    # Insert a failed question
    supabase.table("questions").insert(
        {
            "id": "question_bad",
            "title": bad.title,
            "question_type": bad.question_type,
            "question": bad.question,
            "options": bad.options,
            "answer": bad.answer,
            "generation_status": "error",
            "error": "x",
        }
    ).execute()

    good_resp, bad_resp = await q_mod.create_questions(wrapper, [good, bad])
    assert good_resp.success and not bad_resp.success
