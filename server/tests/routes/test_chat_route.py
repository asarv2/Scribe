# tests/routes/test_chat_route.py
import pytest
from datetime import datetime
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.extensions import get_supabase
from app.routes.chat_route import router


@pytest.fixture
def client():
    """
    Mount the chat router on a fresh FastAPI app for testing.
    """
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


@pytest.fixture
def mock_supabase(monkeypatch, supabase):
    """
    Fixture to ensure the chat_route uses our test supabase instance
    """
    monkeypatch.setattr("app.routes.chat_route.get_supabase", lambda: supabase)
    return supabase


def test_chat_not_found(client):
    """
    If there is no row in `chats` for the given chat_id,
    we should get a 404 "Chat not found".
    """
    resp = client.post("/message", data={"chat_id": "no-such-chat", "message_id": "msg-1"})
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Chat not found"


def test_class_not_found(client, mock_supabase):
    """
    If a chat exists but its `class` does not exist in `classes`,
    we should get a 404 "Class not found".
    """
    # insert only into chats
    mock_supabase.table("chats").insert({
        "id": "chat1",
        "trace": "trace-123",
        "class": "class-missing",
        "profile": "prof1",
        "teacher": False,
        "used_files": [],
        "used_documents": [],
    }).execute()

    resp = client.post("/message", data={"chat_id": "chat1", "message_id": "msg-1"})
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Class not found"


def test_message_not_found(client, mock_supabase):
    """
    If both chat and class exist but there is no message with that id,
    we should get a 404 "Message not found".
    """
    # insert chat
    mock_supabase.table("chats").insert({
        "id": "chatX",
        "trace": "tX",
        "class": "classX",
        "profile": "profX",
        "teacher": True,
        "used_files": [],
        "used_documents": [],
    }).execute()
    # insert class
    mock_supabase.table("classes").insert({
        "id": "classX",
        "title": "Some Title",
        "course_description": "Desc",
    }).execute()
    # no messages inserted

    resp = client.post("/message", data={"chat_id": "chatX", "message_id": "missing-msg"})
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Message not found"


def test_handle_chat_success(client, mock_supabase, monkeypatch):
    """
    Full happy‐path: chat + class + messages exist, all helpers stubbed,
    ChatProcessor.process_message does nothing,
    and we get back {"status":"success","message_id":...}.
    Also validates that the message row ends up with generation_status="complete".
    """
    # 1) stub out all the async helpers so they return minimal values
    monkeypatch.setattr(
        "app.services.chat.utils.references.fetch_chat_context",
        lambda supabase_client, chat_id, class_id: {
            "figures": [], "summaries": [], "questions": [], "outcomes": []
        },
    )
    monkeypatch.setattr(
        "app.services.chat.utils.references.get_mapped_references",
        lambda supabase_client, f_ids, d_ids, all_f, all_d: ([], [], []),
    )
    monkeypatch.setattr(
        "app.services.chat.utils.outcomes.get_mapped_outcomes",
        lambda supabase_client, class_id, outcomes: ([], "", ""),
    )

    # 2) stub ChatProcessor so we never do real AI work
    class DummyProcessor:
        def __init__(self, **kwargs):
            # Store any kwargs that might be needed for assertions
            self.kwargs = kwargs
            # Mock a valid starting agent that would be returned by graph.forward()
            self.starting_agent = "content"  # Using a valid agent name

        async def process_message(self, chat_id, outcomes_description, documents):
            # no-op
            return

    # Mock the entire ChatProcessor class
    monkeypatch.setattr(
        "app.routes.chat_route.ChatProcessor",
        DummyProcessor,
    )

    # 3) insert a chat, class, and two messages (one past, one current)
    mock_supabase.table("chats").insert({
        "id": "chat-ok",
        "trace": "trace-ok",
        "class": "class-ok",
        "profile": "prof-ok",
        "teacher": False,
        "used_files": [],
        "used_documents": [],
    }).execute()

    mock_supabase.table("classes").insert({
        "id": "class-ok",
        "title": "OK Title",
        "course_description": "Course OK",
    }).execute()

    now = datetime.now().isoformat()
    # past message
    mock_supabase.table("messages").insert({
        "id": "m0",
        "chat": "chat-ok",
        "bare_question": "Q0",
        "bare_response": "A0",
        "start_agent": "content",  # Use a valid agent name
        "files": [],
        "documents": [],
        "created_at": now,
    }).execute()
    # current message
    mock_supabase.table("messages").insert({
        "id": "m1",
        "chat": "chat-ok",
        "bare_question": "Q1",
        "start_agent": "content",  # Use a valid agent name
        "files": [],
        "documents": [],
        "created_at": now,
    }).execute()

    # 4) call the endpoint
    resp = client.post("/message", data={"chat_id": "chat-ok", "message_id": "m1"})
    assert resp.status_code == 200
    assert resp.json() == {"status": "success", "message_id": "m1"}

    # 5) verify generation_status was set to "complete"
    updated = mock_supabase.table("messages").select("*").eq("id", "m1").execute().data[0]
    assert updated["generation_status"] == "complete"
