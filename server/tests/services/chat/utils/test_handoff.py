# test_handoff.py

"""
Unit-tests for the helper functions in
app.services.chat.utils.handoff (invoke_handoff, handoff_input_filter)

The shared fixtures in tests/conftest.py give us:
  • an in-memory Supabase (supabase)
  • a fake Gemini client (google_client)
  • heavy-library stubs (torch, fitz, magic …)

Here we test the handoff functionality specifically.
"""

from __future__ import annotations

import asyncio

import pytest
from unittest.mock import MagicMock

# code-under-test
from app.services.chat.utils import handoff as handoff_mod
from app.services.chat.models.general import HandoffInputSchema
from agents import Agent, HandoffInputData, HandoffCallItem


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
def mock_agent():
    """Create a mock Agent for testing."""
    return MagicMock(spec=Agent)


@pytest.fixture
def mock_wrapper():
    """Create a mock RunContextWrapper for testing."""
    # Create the wrapper mock without strict spec checking
    wrapper = MagicMock()

    # Create a context object with the necessary attributes
    context = MagicMock()
    context.references = {
        1: {"id": "doc1", "file": False},
        2: {"id": "file1", "file": True},
        3: {"id": "doc2", "file": False},
    }
    context.used_files = []
    context.used_documents = []

    # Attach the context to the wrapper
    wrapper.context = context

    return wrapper


# ────────────────────────────────────────────────────────────────────────────
# invoke_handoff tests
# ────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_invoke_handoff_adds_references(mock_agent, mock_wrapper):
    """Test that invoke_handoff correctly adds references to the context."""
    # Create the handoff function
    handoff_fn = handoff_mod.invoke_handoff(mock_agent)

    # Create arguments with references 1 and 2
    args = HandoffInputSchema(references=[1, 2])
    args_json = args.model_dump_json()

    # Call the handoff function
    result = await handoff_fn(mock_wrapper, args_json)

    # Check that the agent was returned
    assert result == mock_agent

    # Check that the references were added to the context
    assert "doc1" in mock_wrapper.context.used_documents
    assert "file1" in mock_wrapper.context.used_files


@pytest.mark.asyncio
async def test_invoke_handoff_handles_missing_references(mock_agent, mock_wrapper):
    """Test that invoke_handoff handles references that don't exist."""
    # Create the handoff function
    handoff_fn = handoff_mod.invoke_handoff(mock_agent)

    # Create arguments with a non-existent reference
    args = HandoffInputSchema(references=[4, 1])
    args_json = args.model_dump_json()

    # Call the handoff function
    await handoff_fn(mock_wrapper, args_json)

    # Check that only the valid reference was added
    assert "doc1" in mock_wrapper.context.used_documents
    assert len(mock_wrapper.context.used_documents) == 1
    assert len(mock_wrapper.context.used_files) == 0


@pytest.mark.asyncio
async def test_invoke_handoff_with_multiple_references(mock_agent, mock_wrapper):
    """Test that invoke_handoff correctly handles multiple references."""
    # Create the handoff function
    handoff_fn = handoff_mod.invoke_handoff(mock_agent)

    # Create arguments with all references
    args = HandoffInputSchema(references=[1, 2, 3])
    args_json = args.model_dump_json()

    # Call the handoff function
    await handoff_fn(mock_wrapper, args_json)

    # Check that all references were added correctly
    assert set(mock_wrapper.context.used_documents) == {"doc1", "doc2"}
    assert set(mock_wrapper.context.used_files) == {"file1"}


# ────────────────────────────────────────────────────────────────────────────
# handoff_input_filter tests
# ────────────────────────────────────────────────────────────────────────────
def test_handoff_input_filter_returns_unchanged_data():
    """Test that handoff_input_filter returns the input data unchanged."""
    # Create mock input data
    input_history = [{"role": "user", "content": "Hello"}]
    pre_handoff_items = []
    new_items = [MagicMock(spec=HandoffCallItem)]

    input_data = HandoffInputData(
        input_history=input_history,
        pre_handoff_items=pre_handoff_items,
        new_items=new_items,
    )

    # Call the filter function
    result = handoff_mod.handoff_input_filter(input_data)

    # Check that the data is returned unchanged
    assert result.input_history == input_history
    assert result.pre_handoff_items == pre_handoff_items
    assert result.new_items == new_items


# The following test is commented out since the functionality is currently disabled in the code
# but would be useful if the functionality is re-enabled

"""
@pytest.mark.parametrize(
    "input_history,expected_references",
    [
        # Test case with references in history
        (
            [
                {"call_id": "references", "output": json.dumps({"references": [{"number": 1, "title": "Doc1"}]})},
            ],
            ["Doc1"],
        ),
        # Test case with no references
        (
            [{"call_id": "other", "output": "{}"}],
            [],
        ),
    ],
)
def test_handoff_input_filter_with_references(input_history, expected_references):
    # This test would verify that references are correctly extracted and processed
    # when the commented-out functionality is re-enabled
    pass
"""
