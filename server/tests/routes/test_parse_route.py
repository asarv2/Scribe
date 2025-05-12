# tests/routes/test_parse_route.py
import os
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.routes.parse_route import router
from app.config import model_manager


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


@pytest.fixture
def mock_supabase(monkeypatch, supabase):
    """
    Ensure parse_route uses the test supabase instance.
    """
    monkeypatch.setattr("app.routes.parse_route.get_supabase", lambda: supabase)
    return supabase


#
# ─── /syllabus TESTS ────────────────────────────────────────────────────────────
#
def test_syllabus_class_not_found(client, mock_supabase):
    # No class data in the database
    r = client.post("/syllabus", data={"class_id": "nope"})
    assert r.status_code == 404
    assert "Class not found" in r.json()["detail"]


def test_syllabus_no_syllabus_file(client, mock_supabase):
    # Add a class without a syllabus file
    mock_supabase.table("classes").insert(
        {"id": "class1", "title": "Test Class", "syllabus": None}
    ).execute()

    r = client.post("/syllabus", data={"class_id": "class1"})
    assert r.status_code == 400
    assert "No syllabus file found" in r.json()["detail"]


def test_syllabus_google_file_not_found(client, mock_supabase, monkeypatch):
    # Add a class with a syllabus file
    mock_supabase.table("classes").insert(
        {"id": "class2", "title": "Test Class", "syllabus": "file1"}
    ).execute()

    # Add a file entry but no google file entry
    mock_supabase.table("files").insert({"id": "file1", "title": "Test File"}).execute()

    # Add empty result for google_files query
    mock_supabase.table("google_files").insert([]).execute()

    r = client.post("/syllabus", data={"class_id": "class2"})
    assert r.status_code == 404
    assert "Google file not found" in r.json()["detail"]


def test_syllabus_success(client, mock_supabase, monkeypatch):
    # Add a class with a syllabus file
    mock_supabase.table("classes").insert(
        {"id": "class3", "title": "Test Class", "syllabus": "file2"}
    ).execute()

    # Add file and google file entries
    mock_supabase.table("files").insert({"id": "file2", "title": "Test File"}).execute()

    mock_supabase.table("google_files").insert(
        {"file": "file2", "google_id": "google123"}
    ).execute()

    # Add empty outcomes table
    mock_supabase.table("outcomes").insert([]).execute()

    # Mock the FileParser class
    class MockFileParser:
        def __init__(self, *args, **kwargs):
            pass

        async def parse_syllabus(self, *args, **kwargs):
            return (
                "Updated Class",
                "CS101",
                "This is a description",
                ["Outcome 1", "Outcome 2"],
            )

    monkeypatch.setattr("app.routes.parse_route.FileParser", MockFileParser)

    r = client.post("/syllabus", data={"class_id": "class3"})
    assert r.status_code == 200
    assert "Syllabus parsed successfully" in r.json()["detail"]


#
# ─── /audio TESTS ───────────────────────────────────────────────────────────────
#
def test_audio_no_file(client):
    # Use the correct format for the request
    r = client.post("/audio", files={"audio_file": ("", b"")})
    assert r.status_code == 400
    assert "No audio file provided" in r.json()["detail"]


def test_audio_unsupported_format(client):
    r = client.post("/audio", files={"audio_file": ("sound.txt", b"data")})
    assert r.status_code == 400
    assert "Unsupported file format" in r.json()["detail"]


def test_audio_success(client, monkeypatch, tmp_path):
    # 1) stub whisper model
    class DummyWhisperModel:
        def transcribe(self, path, task, fp16):
            # file should exist on disk
            assert os.path.exists(path)
            return {
                "text": "hello world",
                "language": "en",
                "segments": [{"id": 0, "start": 0.0, "end": 1.0, "text": "hello"}],
            }

    monkeypatch.setattr(model_manager, "get_whisper_model", lambda: DummyWhisperModel())

    # 2) send a valid .wav file
    content = b"RIFF....WAVE"  # dummy WAV header
    r = client.post(
        "/audio",
        files=[("audio_file", ("test.wav", content))],
        data={"task": "translate"},
    )

    assert r.status_code == 200
    body = r.json()
    assert body["text"] == "hello world"
    assert body["language"] == "en"
    assert isinstance(body["segments"], list)
    seg = body["segments"][0]
    assert seg == {"id": 0, "start": 0.0, "end": 1.0, "text": "hello"}
