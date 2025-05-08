# test_agents.py
"""
Offline smoke-tests for the six chat agents:

    • AnalyzeAgent   • ContentAgent   • GradeAgent
    • HomeworkAgent  • LearnAgent     • ReviewAgent

The goal is _not_ to talk to a model, merely to prove that:

  1.  agent.agent() returns an `Agent` object in both
      - "cached" (emit_google_cache returns a name) and
      - "uncached" (no cache) modes;
  2.  handoff() returns a `Handoff` object whose
      attributes look sane;
  3.  for agents that expose extra tools in the uncached
      path, those tools are present.

No network, no real Gemini/LiteLLM clients: everything is
stubbed with ultra-light fakes.
"""

from __future__ import annotations

from importlib import import_module
from types import SimpleNamespace

import pytest


# ────────────────────────────────────────────────────────────────
# helper to patch one agent module for a test case
# ────────────────────────────────────────────────────────────────
def _patch_agent_module(
    monkeypatch: pytest.MonkeyPatch,
    module_name: str,
    *,
    cached: bool,
) -> None:
    """Replace emit_google_cache in <module_name>."""
    mod = import_module(module_name)

    # emit_google_cache decides the branch we want to test
    def _emit_cache(
        chat_id: str,
        model_name: str,
        sys_prompt: str,
        new_refs: bool,
        all_refs: list,
    ) -> str | None:
        return "cached_blob" if cached else ""

    monkeypatch.setattr(mod, "emit_google_cache", _emit_cache, raising=True)

    # NEW: Stub model helpers
    monkeypatch.setattr(
        mod,
        "get_litellm",
        lambda: SimpleNamespace(model="fake-llm"),
        raising=False,
    )
    monkeypatch.setattr(
        mod,
        "get_gemini",
        lambda: SimpleNamespace(),
        raising=False,
    )


# ────────────────────────────────────────────────────────────────
# parameter-table of every agent we want to test
#   (import path, class name, expects_tools_when_uncached)
# ────────────────────────────────────────────────────────────────
AGENT_SPECS: list[tuple[str, str, bool]] = [
    ("app.services.chat.agents.specialists.analyze", "AnalyzeAgent", True),
    ("app.services.chat.agents.specialists.content", "ContentAgent", False),
    ("app.services.chat.agents.specialists.grade", "GradeAgent", False),
    ("app.services.chat.agents.specialists.homework", "HomeworkAgent", True),
    ("app.services.chat.agents.specialists.learn", "LearnAgent", True),
    ("app.services.chat.agents.specialists.review", "ReviewAgent", True),
]

# Build readable ids for pytest output
IDS = [spec[1] for spec in AGENT_SPECS]


# ────────────────────────────────────────────────────────────────
# Tests
# ────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("mod_name,cls_name,has_tools", AGENT_SPECS, ids=IDS)
@pytest.mark.parametrize("cached", [True, False], ids=["cached", "uncached"])
def test_agent_builds(
    monkeypatch: pytest.MonkeyPatch,
    mod_name: str,
    cls_name: str,
    has_tools: bool,
    cached: bool,
) -> None:
    """
    For each agent and each cache-state we:

      • patch external helpers
      • build the Agent instance
      • check a handful of invariants
    """
    # patch helpers inside the agent's module
    _patch_agent_module(monkeypatch, mod_name, cached=cached)

    # import the class *after* patching so the stubbed fns are in place
    agent_cls: type = getattr(import_module(mod_name), cls_name)

    # Build the wrapper object
    agent_builder = agent_cls(chat_id="chat-001")

    # 1) agent()
    built_agent = agent_builder.agent(new_references=False, all_references=[])

    # basic sanity
    assert built_agent.name.startswith(cls_name.split("Agent")[0]), "Wrong .name"

    # tools only exist in the UNCACHED branch for certain agents
    if not cached and has_tools:
        assert getattr(built_agent, "tools", []), "Tools list should be non-empty"
    elif cached:
        # In cached mode no explicit tools list is supplied
        assert not getattr(built_agent, "tools", []), (
            "Cached path should not expose tools"
        )

    # 2) handoff()
    handoff_obj = agent_builder.handoff(built_agent)

    assert handoff_obj.agent_name.startswith(cls_name.split("Agent")[0]), (
        "handoff agent_name mismatch"
    )
    # must expose a callable on_invoke_handoff
    assert callable(getattr(handoff_obj, "on_invoke_handoff")), (
        "handoff missing callback"
    )
