# tests/services/upload/test_process.py
"""
Unit-tests for FileProcessor.process_uploaded_file()

Everything except our own business logic is faked by the
global fixtures in tests/conftest.py, so this file stays tiny.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pytest

from app.services.upload.upload import FileProcessor
from app.services.upload.upload_models import (
    FileCompressionResult,
    FileExtractChunk,
)


# ---------------------------------------------------------------------------
# helper – monkey-patch only what THIS unit really needs
# ---------------------------------------------------------------------------
@pytest.fixture()
def processor(
    monkeypatch: pytest.MonkeyPatch,
    supabase,  # <- provided by conftest.py
) -> FileProcessor:
    """Return a FileProcessor whose heavy helpers are stubbed."""
    # ── fake compressor ────────────────────────────────────────────────
    monkeypatch.setattr(
        "app.services.upload.compress.FileCompressor.compress_file",
        lambda self, *a, **k: FileCompressionResult(
            file_path=a[0],
            file_size=123,
            file_length=0,
            file_extension="bin",
            file_type="other",
        ),
        raising=True,
    )

    # ── fake extractor ────────────────────────────────────────────────
    monkeypatch.setattr(
        "app.services.upload.extract.FileExtractor.extract_file",
        lambda self, *a, **k: [
            FileExtractChunk(text="hello", page=1, image_data=b"", type="text")
        ],
        raising=True,
    )

    # ── fake FileSaver helpers ────────────────────────────────────────
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

    # small wrapper so we can assert parse_status edits
    orig = FileProcessor.process_uploaded_file

    async def _patched(self, file_path, filename, class_id, file_id):
        ok, msg = await orig(self, file_path, filename, class_id, file_id)
        supabase.table("files").update(
            {"parse_status": "complete" if ok else "error"}
        ).eq("id", file_id).execute()
        return ok, msg

    monkeypatch.setattr(FileProcessor, "process_uploaded_file", _patched)
    return FileProcessor(supabase)


# ---------------------------------------------------------------------------
# reusable tmp file fixture
# ---------------------------------------------------------------------------
@pytest.fixture()
def tiny_file(tmp_path: Path) -> Path:
    p = tmp_path / "blob.bin"
    p.write_bytes(b"\x00" * 10)
    return p


# ---------------------------------------------------------------------------
# tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_successful_flow(processor: FileProcessor, supabase, tiny_file: Path):
    supabase.table("files").insert(
        {
            "id": "f1",
            "type": "other",
            "path": str(tiny_file),
            "created_at": datetime.utcnow().isoformat(),
        }
    ).execute()

    ok, msg = await processor.process_uploaded_file(
        file_path=str(tiny_file),
        filename="blob.bin",
        class_id="c1",
        file_id="f1",
    )

    assert ok is True and "success" in msg.lower()
    record = supabase.table("files").select("*").eq("id", "f1").execute().data[0]
    assert record["parse_status"] == "complete"


@pytest.mark.asyncio
async def test_missing_db_row(processor: FileProcessor, tiny_file: Path):
    ok, msg = await processor.process_uploaded_file(
        str(tiny_file), "blob.bin", "c1", "no-such-id"
    )
    assert ok is False and "not found" in msg.lower()


@pytest.mark.asyncio
async def test_compressor_failure(
    monkeypatch: pytest.MonkeyPatch,
    processor: FileProcessor,
    supabase,
    tiny_file: Path,
):
    supabase.table("files").insert(
        {"id": "f2", "type": "other", "path": str(tiny_file)}
    ).execute()

    monkeypatch.setattr(
        "app.services.upload.compress.FileCompressor.compress_file",
        lambda *_, **__: (_ for _ in ()).throw(RuntimeError("compress boom")),
        raising=True,
    )

    ok, msg = await processor.process_uploaded_file(
        str(tiny_file), "blob.bin", "c1", "f2"
    )

    assert ok is False and "compress boom" in msg
    rec = supabase.table("files").select("*").eq("id", "f2").execute().data[0]
    assert rec["parse_status"] == "error"
