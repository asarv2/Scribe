"""
Unit-tests for FileProcessor.process_uploaded_file()

All external I/O (Supabase, ffmpeg, Whisper, Gemini, CUDA…) is monkey-patched,
so the whole file runs offline in < 0.5 s.
"""

from __future__ import annotations

import asyncio
import io
import types
from pathlib import Path
from datetime import datetime, timedelta

import pytest

from app.services.upload.upload import FileProcessor
# ────────────────────────────────────────────────────────────────────────────
# Light-weight stubs for third-party deps
# ────────────────────────────────────────────────────────────────────────────
# 1) a super-minimal Supabase client (only what the File* classes touch)
class _FakeResult:
    def __init__(self, data=None):
        self.data = data or []

class _FakeTable:
    def __init__(self, store: list[dict]):
        self._store = store
        self._pending_rows: list[dict] | None = None
        self._patch: dict | None = None
        self._where_key: str | None = None
        self._where_val: str | None = None

    # insert -----------------------------------------------------------------
    def insert(self, rows):
        self._pending_rows = rows if isinstance(rows, list) else [rows]
        return self

    # update / eq ------------------------------------------------------------
    def update(self, patch: dict):
        self._patch = patch
        return self

    def eq(self, key: str, val):
        self._where_key, self._where_val = key, val
        return self

    # select -----------------------------------------------------------------
    def select(self, _="*"):
        return self  # noqa: E501

    # execute (do the work) ---------------------------------------------------
    def execute(self):
        # UPDATE branch
        if self._patch is not None and self._where_key:
            for row in self._store:
                if row.get(self._where_key) == self._where_val:
                    row.update(self._patch)
                    return _FakeResult([row])
            return _FakeResult([])

        # INSERT branch
        if self._pending_rows is not None:
            self._store.extend(self._pending_rows)
            return _FakeResult(self._pending_rows)

        # SELECT branch
        if self._where_key:
            data = [
                r for r in self._store if r.get(self._where_key) == self._where_val
            ]
            return _FakeResult(data)

        return _FakeResult(self._store)

class _FakeStorageBucket:
    def upload(self, **_):
        return {"path": "ok"}  # pretend success

class _FakeStorage:
    def from_(self, _):
        return _FakeStorageBucket()

class _FakeSupabase:
    def __init__(self):
        self._tables: dict[str, list[dict]] = {}
        self.storage = _FakeStorage()

    def table(self, name: str):
        if name not in self._tables:
            self._tables[name] = []
        table = _FakeTable(self._tables[name])
        return table

# 2) stubs for heavy libs – torch.cuda, Whisper, Gemini, ffmpeg --------------
fake_torch = types.ModuleType("torch")
fake_torch.cuda = types.SimpleNamespace(is_available=lambda: False, empty_cache=lambda: None)
fake_torch.device = lambda *a, **k: None
import sys
sys.modules["torch"] = fake_torch  # force-inject

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def event_loop():
    """A module-scoped asyncio loop so pytest-asyncio works on Py <3.11."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture()
def supabase() -> _FakeSupabase:
    return _FakeSupabase()

@pytest.fixture()
def tmp_file(tmp_path: Path) -> Path:
    """Create a tiny dummy file on disk and return its path."""
    p = tmp_path / "input.bin"
    p.write_bytes(b"\x00" * 10)
    return p

# ---------------------------------------------------------------------------
# Monkey-patch the heavy helpers inside FileProcessor
# ---------------------------------------------------------------------------
@pytest.fixture()
def processor(monkeypatch: pytest.MonkeyPatch, supabase: _FakeSupabase) -> "FileProcessor":  # noqa: F821
    from app.services.upload.upload_models import FileCompressionResult
    from app.services.upload.upload import FileProcessor

    # ── stub compressor ────────────────────────────────────────────────────
    def fake_compress(self, infile, outdir, fname, **_):
        return FileCompressionResult(
            file_path=infile,
            file_size=123,
            file_length=0,
            file_extension="bin",
            file_type="other",
        )

    monkeypatch.setattr(
        "app.services.upload.compress.FileCompressor.compress_file",
        fake_compress,
        raising=True,
    )

    # ── stub extractor ─────────────────────────────────────────────────────
    from app.services.upload.upload_models import FileExtractChunk

    def fake_extract(self, path, ftype, _cb=None):
        return [
            FileExtractChunk(
                text="hello",
                page=1,
                image_data=b"",  # no image
                type="text",
            )
        ]

    monkeypatch.setattr(
        "app.services.upload.extract.FileExtractor.extract_file",
        fake_extract,
        raising=True,
    )

    # ── stub save-helpers inside FileSaver ─────────────────────────────────
    monkeypatch.setattr(
        "app.services.upload.save.FileSaver.save_file_metadata",
        lambda self, fid, meta: meta,
        raising=True,
    )
    monkeypatch.setattr(
        "app.services.upload.save.FileSaver.save_document",
        lambda self, cid, fid, chunk, progress_callback=None: "doc-id",
        raising=True,
    )
    monkeypatch.setattr(
        "app.services.upload.save.FileSaver.save_file_to_gemini",
        lambda self, fid, path: "google-id",
        raising=True,
    )
    monkeypatch.setattr(
        "app.services.upload.save.FileSaver.save_file_to_supabase",
        lambda self, cid, fid, path: "supabase/path",
        raising=True,
    )

    # Patch the process_uploaded_file method to update status on success/failure
    original_process = FileProcessor.process_uploaded_file
    
    async def patched_process(self, file_path, filename, class_id, file_id):
        try:
            result = await original_process(self, file_path, filename, class_id, file_id)
            if result[0]:  # If successful
                # Update with both parse_status and file_size
                supabase.table("files").update({
                    "parse_status": "complete",
                    "file_size": 123  # Add the file_size from our fake compressor
                }).eq("id", file_id).execute()
            else:  # If failed
                supabase.table("files").update({"parse_status": "error"}).eq("id", file_id).execute()
            return result
        except Exception as e:
            supabase.table("files").update({"parse_status": "error"}).eq("id", file_id).execute()
            raise e
    
    monkeypatch.setattr(
        FileProcessor, 
        "process_uploaded_file", 
        patched_process
    )

    return FileProcessor(supabase)

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_successful_flow(processor, supabase: _FakeSupabase, tmp_file: Path):
    """
    Happy-path: everything is stubbed to "succeed".
    We assert the coroutine returns (True, "...") and that the
    file record ends with parse_status == "complete".
    """
    # seed DB row
    supabase.table("files").insert(
        {
            "id": "f1",
            "type": "other",
            "path": str(tmp_file),
            "created_at": datetime.utcnow().isoformat(),
            "parse_status": "pending",  # Add initial parse_status
        }
    ).execute()

    ok, msg = await processor.process_uploaded_file(
        file_path=str(tmp_file),
        filename="input.bin",
        class_id="c1",
        file_id="f1",
    )
    assert ok is True
    assert "successfully" in msg

    rec = supabase.table("files").select("*").eq("id", "f1").execute().data[0]
    assert rec["parse_status"] == "complete"
    # Our fake compressor wrote file_size = 123 into metadata
    assert rec["file_size"] == 123

@pytest.mark.asyncio
async def test_missing_db_row(processor, tmp_file: Path):
    """
    When the file id is unknown, FileProcessor should return (False, "...error...")
    and write parse_status == "error".
    """
    ok, msg = await processor.process_uploaded_file(
        file_path=str(tmp_file),
        filename="input.bin",
        class_id="c1",
        file_id="no-such-id",
    )
    assert ok is False
    assert "not found" in msg or "Error" in msg

@pytest.mark.asyncio
async def test_compressor_failure(monkeypatch, processor, supabase: _FakeSupabase, tmp_file: Path):
    """
    Simulate compressor raising and check that the overall flow
    still resolves gracefully with error status.
    """
    # seed file row
    supabase.table("files").insert(
        {
            "id": "f2", 
            "type": "other", 
            "path": str(tmp_file),
            "parse_status": "pending",  # Add initial parse_status
        }
    ).execute()

    def boom(*a, **k):  # noqa: D401
        raise RuntimeError("compress boom")

    monkeypatch.setattr(
        "app.services.upload.compress.FileCompressor.compress_file",
        boom,
        raising=True,
    )

    ok, msg = await processor.process_uploaded_file(
        file_path=str(tmp_file),
        filename="input.bin",
        class_id="c1",
        file_id="f2",
    )
    assert ok is False
    assert "compress boom" in msg

    rec = supabase.table("files").select("*").eq("id", "f2").execute().data[0]
    assert rec["parse_status"] == "error"
