# tests/services/upload/test_save.py
"""
Unit-tests for app.services.upload.save.FileSaver

All heavy externals are stubbed once in tests/conftest.py, so this file
contains only the assertions specific to FileSaver itself.
"""

from __future__ import annotations

from pathlib import Path
import types

import pytest

import app.services.upload.save as save_mod

FileSaver = save_mod.FileSaver
FileExtractChunk = save_mod.FileExtractChunk


# ────────────────────────────────────────────────────────────────────
# fixtures
# ────────────────────────────────────────────────────────────────────
@pytest.fixture()
def saver(supabase, google_client):  # ← fixtures come from conftest.py
    """Fresh FileSaver wired to the in-memory Supabase + fake Gemini."""
    return FileSaver(supabase_client=supabase)


@pytest.fixture()
def tiny_png(tmp_path: Path) -> Path:
    from PIL import Image

    p = tmp_path / "tiny.png"
    Image.new("RGB", (1, 1)).save(p)
    return p


# ────────────────────────────────────────────────────────────────────
# helpers
# ────────────────────────────────────────────────────────────────────
def _pdf_chunk(img: bytes) -> FileExtractChunk:
    return FileExtractChunk(text="lorem", page=1, image_data=img, type="pdf_page")


# ────────────────────────────────────────────────────────────────────
# tests – save_file_metadata
# ────────────────────────────────────────────────────────────────────
def test_save_file_metadata_success(saver: FileSaver):
    saver.supabase.table("files").insert({"id": "f1", "foo": 1}).execute()
    out = saver.save_file_metadata("f1", {"foo": 42})
    assert out["foo"] == 42


def test_save_file_metadata_not_found(saver: FileSaver):
    assert saver.save_file_metadata("nope", {"x": 1}) == {}


# ────────────────────────────────────────────────────────────────────
# tests – save_document
# ────────────────────────────────────────────────────────────────────
def test_save_document_pdf(saver: FileSaver, tiny_png: Path):
    img = tiny_png.read_bytes()
    doc_id = saver.save_document("class1", "file1", _pdf_chunk(img))

    # Verify document ID was generated
    assert doc_id is not None

    # Check that the image was uploaded to storage
    stored_path = f"class1/file1/{doc_id}.png"
    uploads = saver.supabase.storage.from_("files").uploads
    assert stored_path in uploads
    assert uploads[stored_path] == img


def test_save_document_video(tmp_path: Path, saver: FileSaver):
    mp4 = tmp_path / "seg.mp4"
    mp4.write_bytes(b"\x00\x00")

    chunk = FileExtractChunk(
        text="frame 0-30",
        page=1,
        start_time=0.0,
        end_time=30.0,
        type="video_chunk",
        video_chunk_path=str(mp4),
    )
    doc_id = saver.save_document("cls", "fileX", chunk)

    # Verify document ID was generated
    assert doc_id is not None

    # Check that the video was uploaded to storage
    stored_path = f"cls/fileX/{doc_id}.mp4"
    uploads = saver.supabase.storage.from_("files").uploads
    assert stored_path in uploads
    assert uploads[stored_path] == b"\x00\x00"


def test_save_document_audio_missing(tmp_path: Path, saver: FileSaver):
    chunk = FileExtractChunk(
        text="hello",
        page=1,
        start_time=0.0,
        end_time=10.0,
        type="audio_chunk",
        audio_chunk_path=str(tmp_path / "missing.wav"),
    )
    doc_id = saver.save_document("cls", "fileY", chunk)

    # Verify document ID was generated
    assert doc_id is not None

    # No uploads should happen since the file is missing
    uploads = saver.supabase.storage.from_("files").uploads
    assert len(uploads) == 0


# ────────────────────────────────────────────────────────────────────
# tests – Gemini & Supabase uploads
# ────────────────────────────────────────────────────────────────────
def test_save_file_to_gemini(tmp_path: Path, saver: FileSaver, monkeypatch):
    fp = tmp_path / "blob.bin"
    fp.write_bytes(b"123")

    monkeypatch.setattr(
        saver.google.files,
        "upload",
        lambda **kwargs: types.SimpleNamespace(name="google_file_123"),
    )

    gid = saver.save_file_to_gemini("fileZ", str(fp))
    assert gid == "google_file_123"

    row = saver.supabase._tables["google"][0]
    assert row["file"] == "fileZ" and row["google_id"] == gid


def test_save_file_to_supabase(tmp_path: Path, saver: FileSaver):
    txt = tmp_path / "note.txt"
    txt.write_text("hello")

    path = saver.save_file_to_supabase("c1", "f99", str(txt))
    assert path == "c1/f99.txt"

    # Check that the file was uploaded to the correct path
    uploads = saver.supabase.storage.from_("files").uploads
    assert path in uploads
    assert uploads[path] == b"hello"
