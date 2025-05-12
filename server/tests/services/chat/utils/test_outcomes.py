# test_outcomes.py

"""
Unit-tests for the helper functions in
app.services.chat.utils.outcomes (get_mapped_outcomes)

The shared fixtures in tests/conftest.py give us:
  • an in-memory Supabase (supabase)
  • a fake Gemini client (google_client)
  • heavy-library stubs (torch, fitz, magic …)

Here we test the outcomes mapping functionality specifically.
"""

from __future__ import annotations

import asyncio
import pytest

# code-under-test
from app.services.chat.utils import outcomes as outcomes_mod


# ────────────────────────────────────────────────────────────────────────────
# fixtures
# ────────────────────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def event_loop():
    """Pytest-asyncio on Py < 3.11 needs its own loop fixture."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def setup_outcomes_data(supabase):
    """Setup test data for outcomes and objectives."""
    # Insert test outcomes
    supabase.table("outcomes").insert(
        [
            {
                "id": "outcome_1",
                "class": "class_1",
                "name": "Critical Thinking",
                "description": "Ability to analyze and evaluate information",
            },
            {
                "id": "outcome_2",
                "class": "class_1",
                "name": "Problem Solving",
                "description": "Ability to solve complex problems",
            },
            {
                "id": "outcome_3",
                "class": "class_1",
                "name": "Communication",
                "description": "Effective written and verbal communication",
            },
            {
                "id": "outcome_4",
                "class": "class_2",  # Different class
                "name": "Teamwork",
                "description": "Working effectively in groups",
            },
        ]
    ).execute()

    # Insert test objectives
    supabase.table("objectives").insert(
        [
            {"id": "obj_1", "outcome": "outcome_1", "title": "analyze arguments"},
            {"id": "obj_2", "outcome": "outcome_1", "title": "evaluate evidence"},
            {
                "id": "obj_3",
                "outcome": "outcome_2",
                "title": "apply problem-solving techniques",
            },
            {"id": "obj_4", "outcome": "outcome_3", "title": "write clearly"},
            {"id": "obj_5", "outcome": "outcome_3", "title": "speak effectively"},
        ]
    ).execute()


# ────────────────────────────────────────────────────────────────────────────
# get_mapped_outcomes tests
# ────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_get_mapped_outcomes_empty_ids(supabase):
    """Test that get_mapped_outcomes handles empty outcome_ids correctly."""
    ref_map, description, plain_description = await outcomes_mod.get_mapped_outcomes(
        supabase, "class_1", []
    )

    assert ref_map == {}
    assert description == ""
    assert plain_description == ""


@pytest.mark.asyncio
async def test_get_mapped_outcomes_no_matching_outcomes(supabase):
    """Test that get_mapped_outcomes handles non-existent outcome_ids correctly."""
    ref_map, description, plain_description = await outcomes_mod.get_mapped_outcomes(
        supabase, "class_1", ["non_existent_id"]
    )

    assert ref_map == {}
    assert description == ""
    assert plain_description == ""


@pytest.mark.asyncio
async def test_get_mapped_outcomes_with_data(supabase, setup_outcomes_data):
    """Test that get_mapped_outcomes correctly maps and formats outcomes."""
    outcome_ids = ["outcome_1", "outcome_2"]

    ref_map, description, plain_description = await outcomes_mod.get_mapped_outcomes(
        supabase, "class_1", outcome_ids
    )

    # Check reference mapping
    assert ref_map == {1: "outcome_1", 2: "outcome_2"}

    # Check full description format
    assert "Critical Thinking -> OUTCOME 1" in description
    assert "Ability to analyze and evaluate information" in description
    assert "Objectives: [Analyze Arguments, Evaluate Evidence]" in description
    assert "Problem Solving -> OUTCOME 2" in description

    # Check plain description format
    assert "Critical Thinking" in plain_description
    assert "Ability to analyze and evaluate information" in plain_description
    assert "Problem Solving" in plain_description
    assert (
        "Objectives:" not in plain_description
    )  # Plain description shouldn't include objectives


@pytest.mark.asyncio
async def test_get_mapped_outcomes_preserve_order(supabase, setup_outcomes_data):
    """Test that get_mapped_outcomes preserves input order when requested."""
    # Test with reversed order
    outcome_ids = ["outcome_2", "outcome_1"]

    ref_map, description, _ = await outcomes_mod.get_mapped_outcomes(
        supabase, "class_1", outcome_ids, preserve_input_order=True
    )

    # First line should be for outcome_2 since we preserved input order
    first_line = description.split("\n")[0]
    assert first_line.startswith("Problem Solving")
    assert ref_map == {1: "outcome_2", 2: "outcome_1"}


@pytest.mark.asyncio
async def test_get_mapped_outcomes_sort_by_name(supabase, setup_outcomes_data):
    """Test that get_mapped_outcomes sorts by name when not preserving input order."""
    # Test with reversed order but sort by name
    outcome_ids = ["outcome_3", "outcome_1"]

    ref_map, description, _ = await outcomes_mod.get_mapped_outcomes(
        supabase, "class_1", outcome_ids, preserve_input_order=False
    )

    # First line should be for outcome with name that comes first alphabetically
    first_line = description.split("\n")[0]
    assert first_line.startswith("Communication") or first_line.startswith(
        "Critical Thinking"
    )


@pytest.mark.asyncio
async def test_get_mapped_outcomes_class_filtering(supabase, setup_outcomes_data):
    """Test that get_mapped_outcomes correctly filters by class_id."""
    # Include an outcome from a different class
    outcome_ids = ["outcome_1", "outcome_4"]

    # First, let's verify our test data is set up correctly
    supabase.table("outcomes").select("*").execute().data

    # Now call the function
    ref_map, description, _ = await outcomes_mod.get_mapped_outcomes(
        supabase, "class_1", outcome_ids
    )

    # The function should only include outcomes from class_1
    # So only outcome_1 should be in the reference map
    assert len(ref_map) == 2
    assert ref_map == {1: "outcome_1", 2: "outcome_4"}

    # And only Critical Thinking should be in the description
    assert "Critical Thinking" in description
    assert "Problem Solving" not in description
