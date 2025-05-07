"""
Unit-tests for app.services.upload.save.FileSaver

Heavy externals (Supabase, Google GenAI, python-magic, network, real FS)
are replaced by minimal stubs, so the suite runs fully offline and fast.
"""

from __future__ import annotations

import io
import os
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict, List

import pytest

# ────────────────────────────────────────────────────────────────────
# light-weight stub helpers
# ────────────────────────────────────────────────────────────────────
class _FakeResult:
    """Mimic the object Supabase returns from .execute()."""

    def __init__(self, data: List[Dict[str, Any]] | None = None):
        self.data = data or []


class _FakeStorageBucket:
    def __init__(self):
        self.uploads: Dict[str, bytes] = {}

    # supabase.storage.from_("files") → bucket
    def upload(self, *, path: str, file, file_options=None):
        if isinstance(file, (bytes, bytearray)):
            data = bytes(file)
        else:  # file-like
            data = file.read()
        self.uploads[path] = data
        # minimal success sentinel
        return {"Key": path, "Size": len(data)}


class _FakeSupabase:
    """
    Very small subset of the real Supabase client:
    * .table("…").update().eq().execute()
    * .table("…").insert().execute()
    * .storage.from_("files").upload()
    """

    def __init__(self):
        self._tables: Dict[str, List[Dict[str, Any]]] = {
            "files": [],
            "documents": [],
            "google": [],
        }
        self.bucket = _FakeStorageBucket()

    # ----------------------------------------------------------------
    # storage API
    # ----------------------------------------------------------------
    class _StorageCtx:
        def __init__(self, bucket: _FakeStorageBucket):
            self._bucket = bucket

        def upload(self, *args, **kwargs):
            return self._bucket.upload(*args, **kwargs)

    class _Storage:
        def __init__(self, bucket: _FakeStorageBucket):
            self._bucket = bucket

        def from_(self, _name):
            assert _name == "files"
            return _FakeSupabase._StorageCtx(self._bucket)

    @property
    def storage(self):
        return _FakeSupabase._Storage(self.bucket)

    # ----------------------------------------------------------------
    # table() / insert() / update() chain
    # ----------------------------------------------------------------
    def table(self, name: str):
        self._current_table = name
        self._data = {}
        self._where_key = None
        self._where_val = None
        return self

    # ----- INSERT ----------------------------------------------------
    def insert(self, rows):
        if isinstance(rows, dict):
            rows = [rows]
        for row in rows:
            # give deterministic id if none supplied
            row.setdefault("id", f"{self._current_table}_{len(self._tables[self._current_table])+1}")
            self._tables[self._current_table].append(row)
        self._pending_rows = rows
        return self

    # ----- UPDATE … WHERE … -----------------------------------------
    def update(self, patch: Dict[str, Any]):
        self._patch = patch
        return self

    def eq(self, key, val):
        self._where_key, self._where_val = key, val
        return self

    # ----- EXECUTE ---------------------------------------------------
    def execute(self):
        # ----- UPDATE ----------------------------------------------------
        # run the update path first, even if _pending_rows from an earlier
        # insert is still hanging around
        if hasattr(self, "_patch"):
            updated: List[Dict[str, Any]] = []
            for row in self._tables[self._current_table]:
                if row.get(self._where_key) == self._where_val:
                    row.update(self._patch)
                    updated.append(row)
            # clear state for next call
            for attr in ("_patch", "_where_key", "_where_val"):
                if hasattr(self, attr):
                    delattr(self, attr)
            return _FakeResult(updated)

        # ----- INSERT ----------------------------------------------------
        if hasattr(self, "_pending_rows"):
            data = self._pending_rows
            delattr(self, "_pending_rows")          # ← important!
            return _FakeResult(data)

        # default empty result
        return _FakeResult([])


class _FakeGoogle:
    """Stub returned by patched get_google()"""

    class _Files:
        def upload(self, *, file, config):
            # return an object with a .name attr
            return SimpleNamespace(name="google_file_123")

    def __init__(self):
        self.files = _FakeGoogle._Files()


class _FakeMagic:
    """Very small subset of python-magic used in FileSaver."""

    def __init__(self, mime=True):
        self._mime = mime
        self._forced = None

    def from_file(self, _path: str):
        # allow tests to set a fixed mime
        return self._forced or "application/octet-stream"


# ────────────────────────────────────────────────────────────────────
# patch the module *before* importing code-under-test
# ────────────────────────────────────────────────────────────────────
import importlib
import types
import sys

fake_magic_mod = types.ModuleType("magic")
fake_magic_mod.Magic = _FakeMagic
sys.modules.setdefault("magic", fake_magic_mod)

# the extensions.get_google helper must return _FakeGoogle
import app.extensions as _ext_mod
_ext_mod.get_google = lambda: _FakeGoogle()

# finally import the saver
import app.services.upload.save as save_mod

FileSaver = save_mod.FileSaver
FileExtractChunk = save_mod.FileExtractChunk


# ────────────────────────────────────────────────────────────────────
# fixtures
# ────────────────────────────────────────────────────────────────────
@pytest.fixture()
def supabase():
    return _FakeSupabase()


@pytest.fixture()
def saver(supabase):
    return FileSaver(supabase_client=supabase)


@pytest.fixture()
def tiny_png(tmp_path: Path) -> Path:
    from PIL import Image
    p = tmp_path / "img.png"
    Image.new("RGB", (1, 1)).save(p)
    return p


# ────────────────────────────────────────────────────────────────────
# tests – save_file_metadata
# ────────────────────────────────────────────────────────────────────
def test_save_file_metadata_success(saver: FileSaver):
    # pre-seed one row
    saver.supabase.table("files").insert({"id": "f1", "foo": 1}).execute()

    out = saver.save_file_metadata("f1", {"foo": 42})
    assert out and out["foo"] == 42


def test_save_file_metadata_not_found(saver: FileSaver):
    out = saver.save_file_metadata("does-not-exist", {"bar": 1})
    assert out == {}        # nothing updated


# ────────────────────────────────────────────────────────────────────
# tests – save_document (happy-path PDF page with image)
# ────────────────────────────────────────────────────────────────────
def _make_pdf_chunk(img_bytes: bytes) -> FileExtractChunk:
    return FileExtractChunk(
        text="lorem",
        page=1,
        image_data=img_bytes,
        type="pdf_page",
    )


def test_save_document_pdf(tmp_path: Path, saver: FileSaver, tiny_png: Path):
    file_id = "file_1"
    class_id = "class_1"

    # read miniature png as bytes for image_data
    img_bytes = tiny_png.read_bytes()
    chunk = _make_pdf_chunk(img_bytes)

    doc_id = saver.save_document(class_id, file_id, chunk)
    # a new row was created in supabase.documents
    assert doc_id == "documents_1"
    row = saver.supabase._tables["documents"][0]
    assert row["file"] == file_id and row["extension"] == "png"
    # image uploaded to storage
    stored_path = f"{class_id}/{file_id}/{doc_id}.png"
    assert stored_path in saver.supabase.bucket.uploads
    assert saver.supabase.bucket.uploads[stored_path] == img_bytes


# ────────────────────────────────────────────────────────────────────
# tests – save_document with video / audio chunks
# ────────────────────────────────────────────────────────────────────
def test_save_document_video(tmp_path: Path, saver: FileSaver):
    # create a fake mp4 on disk
    mp4 = tmp_path / "seg.mp4"
    mp4.write_bytes(b"\x00\x00")

    chunk = FileExtractChunk(
        text="frame 00-30",
        page=1,
        start_time=0.0,
        end_time=30.0,
        type="video_chunk",
        video_chunk_path=str(mp4),
    )

    doc_id = saver.save_document("cls", "fileX", chunk)
    # video copied into storage
    stored = f"cls/fileX/{doc_id}.mp4"
    assert stored in saver.supabase.bucket.uploads
    assert saver.supabase.bucket.uploads[stored] == mp4.read_bytes()


def test_save_document_no_uploads(tmp_path: Path, saver: FileSaver):
    # audio_chunk_path points to missing file → should be skipped gracefully
    chunk = FileExtractChunk(
        text="hello",
        page=1,
        start_time=0,
        end_time=10,
        type="audio_chunk",
        audio_chunk_path=str(tmp_path / "missing.wav"),
    )
    doc_id = saver.save_document("cls", "fileY", chunk)
    # no upload performed, but DB row still created
    assert doc_id == "documents_1"
    assert not saver.supabase.bucket.uploads            # bucket is empty


# ────────────────────────────────────────────────────────────────────
# tests – Gemini & Supabase file uploads
# ────────────────────────────────────────────────────────────────────
def test_save_file_to_gemini(tmp_path: Path, saver: FileSaver):
    fp = tmp_path / "blob.bin"
    fp.write_bytes(b"123")

    gid = saver.save_file_to_gemini("fileZ", str(fp))
    assert gid == "google_file_123"
    # row inserted in "google" table
    row = saver.supabase._tables["google"][0]
    assert row["file"] == "fileZ" and row["google_id"] == gid


def test_save_file_to_supabase(tmp_path: Path, saver: FileSaver):
    txt = tmp_path / "note.txt"
    txt.write_text("hello")

    path = saver.save_file_to_supabase("c1", "f99", str(txt))
    assert path == "c1/f99.txt"
    assert path in saver.supabase.bucket.uploads
    assert saver.supabase.bucket.uploads[path] == txt.read_bytes()
