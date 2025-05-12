from __future__ import annotations

import sys
import types
from importlib import import_module
from typing import List

import pytest


# ──────────────────────────────────────────────────────────────────────────
# helpers – create one tiny stub module per specialist agent
# ──────────────────────────────────────────────────────────────────────────
class _StubAgent:
    """Every fake specialist agent just records that it was run."""

    def __init__(self, *args, **kwargs):
        # Initialize with any arguments but ignore them
        pass

    def agent(self, *_, **__) -> str:  # AgentBuilder.agent()
        stub_calls.append(self.__class__.__name__)
        return f"ran:{self.__class__.__name__}"


def _install_stub_agents(monkeypatch: pytest.MonkeyPatch) -> None:
    paths = [
        ("app.services.chat.agents.specialists.content", "ContentAgent"),
        ("app.services.chat.agents.specialists.grade", "GradeAgent"),
        ("app.services.chat.agents.specialists.analyze", "AnalyzeAgent"),
        ("app.services.chat.agents.specialists.review", "ReviewAgent"),
        ("app.services.chat.agents.specialists.homework", "HomeworkAgent"),
        ("app.services.chat.agents.specialists.learn", "LearnAgent"),
    ]
    for mod_path, cls_name in paths:
        mod = types.ModuleType(mod_path)
        # Create a stub class that inherits from _StubAgent
        stub_cls = type(cls_name, (_StubAgent,), {})
        setattr(mod, cls_name, stub_cls)

        # Patch the module's imports
        for helper in ("get_litellm", "get_gemini", "emit_google_cache"):
            setattr(mod, helper, lambda *a, **k: None)

        # Install the module
        monkeypatch.setitem(sys.modules, mod_path, mod)

    # Also patch the AgentGraph class to use our stub agents directly
    graph_mod = import_module("app.services.chat.utils.graph")
    original_init = graph_mod.AgentGraph.__init__

    def patched_init(self, *args, **kwargs):
        original_init(self, *args, **kwargs)
        # Replace the agent instances with our stub instances
        for agent_name in [
            "content",
            "grade",
            "analyze",
            "review",
            "homework",
            "learn",
        ]:
            if hasattr(self, agent_name):
                agent_cls_name = f"{agent_name.capitalize()}Agent"
                for mod_path, cls_name in paths:
                    if cls_name == agent_cls_name:
                        stub_cls = getattr(sys.modules[mod_path], cls_name)
                        setattr(self, agent_name, stub_cls())

    monkeypatch.setattr(graph_mod.AgentGraph, "__init__", patched_init)


# container for call tracking
stub_calls: List[str] = []


# ──────────────────────────────────────────────────────────────────────────
# tests
# ──────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    ("start", "expect_cls"),
    [("content", "ContentAgent"), ("grade", "GradeAgent"), ("learn", "LearnAgent")],
)
def test_agent_graph_dispatch(monkeypatch, start, expect_cls):
    """Verify AgentGraph invokes the correct specialist agent."""
    stub_calls.clear()
    _install_stub_agents(monkeypatch)

    AgentGraph = import_module("app.services.chat.utils.graph").AgentGraph
    g = AgentGraph(chat_id="xyz", teacher=False, starting_agent=start)

    assert g.forward(False, []) == f"ran:{expect_cls}"
    assert stub_calls == [expect_cls]


def test_agent_graph_invalid(monkeypatch):
    """Starting with an unknown name raises ValueError."""
    _install_stub_agents(monkeypatch)

    AgentGraph = import_module("app.services.chat.utils.graph").AgentGraph
    g = AgentGraph(chat_id="xyz", teacher=False, starting_agent="bogus")

    with pytest.raises(ValueError):
        g.forward(False, [])
