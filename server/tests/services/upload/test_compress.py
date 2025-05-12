# tests/services/upload/test_compress.py
"""
Unit-tests for app.services.upload.compress.FileCompressor

Branches covered
────────────────
✓ video  → compress_video_file
✓ audio  → compress_audio_file
✓ PDF    → compress_pdf_file
✓ Office → _convert_office_to_pdf  (success & failure paths)
✓ other  → compress_other_file
"""

from __future__ import annotations

from pathlib import Path

import pytest
import app.services.upload.compress as compress_mod

FileCompressor = compress_mod.FileCompressor
FileCompressionResult = compress_mod.FileCompressionResult


# ──────────────────────────────────────────────────────────────────────────
# helpers
# ──────────────────────────────────────────────────────────────────────────
def _dummy_result(self, path, ft="image"):
    # Ensure the file path has the correct extension based on file type
    if ft == "video":
        new_path = path.replace(".bin", ".mp4")
    elif ft == "audio":
        new_path = path.replace(".bin", ".wav")
    else:
        new_path = path

    return FileCompressionResult(
        file_path=new_path,
        file_length=0,
        file_size=128,
        file_extension=new_path.split(".")[-1],
        file_type=ft,
    )


# ──────────────────────────────────────────────────────────────────────────
# fixtures
# ──────────────────────────────────────────────────────────────────────────
@pytest.fixture()
def compressor(monkeypatch: pytest.MonkeyPatch) -> FileCompressor:
    """Fresh compressor whose heavy helpers are neutralised."""
    c = FileCompressor()
    # default mime – each test overrides as needed
    monkeypatch.setattr(c.mime, "from_file", lambda _: "application/octet-stream")
    # avoid real ffprobe
    monkeypatch.setattr(FileCompressor, "get_media_duration", lambda *_a, **_k: 42.0)
    return c


@pytest.fixture()
def tiny(tmp_path: Path) -> Path:
    p = tmp_path / "blob.bin"
    p.write_bytes(b"\x00" * 128)
    return p


# ──────────────────────────────────────────────────────────────────────────
# branch tests
# ──────────────────────────────────────────────────────────────────────────
def test_video_branch(monkeypatch, compressor, tiny):
    called = {}
    monkeypatch.setattr(
        FileCompressor,
        "compress_video_file",
        lambda self, *a, **k: (
            called.setdefault("v", True),
            _dummy_result(self, a[0], ft="video"),
        )[1],
        raising=True,
    )
    monkeypatch.setattr(
        compressor.mime, "from_file", lambda _: "video/mp4", raising=True
    )

    res = compressor.compress_file(str(tiny), str(tiny.parent / "out"), tiny.name)
    assert (
        called.get("v") and res.file_type == "video" and res.file_path.endswith(".mp4")
    )


def test_audio_branch(monkeypatch, compressor, tiny):
    called = {}
    monkeypatch.setattr(
        FileCompressor,
        "compress_audio_file",
        lambda self, *a, **k: (
            called.setdefault("a", True),
            _dummy_result(self, a[0], ft="audio"),
        )[1],
        raising=True,
    )
    monkeypatch.setattr(
        compressor.mime, "from_file", lambda _: "audio/mpeg", raising=True
    )

    res = compressor.compress_file(str(tiny), str(tiny.parent), "song.mp3")
    assert (
        called.get("a") and res.file_type == "audio" and res.file_path.endswith(".wav")
    )


def test_pdf_branch(monkeypatch, compressor, tiny):
    called = {}
    monkeypatch.setattr(
        FileCompressor,
        "compress_pdf_file",
        lambda self, *a, **k: (
            called.setdefault("p", True),
            _dummy_result(self, a[0], ft="pdf"),
        )[1],
        raising=True,
    )
    monkeypatch.setattr(
        compressor.mime, "from_file", lambda _: "application/pdf", raising=True
    )

    res = compressor.compress_file(str(tiny), str(tiny.parent), "doc.pdf")
    assert called.get("p") and res.file_type == "pdf"


def test_office_conversion_success(monkeypatch, compressor, tmp_path):
    doc = tmp_path / "report.docx"
    doc.write_text("stub")
    converted = tmp_path / "report.pdf"
    converted.write_bytes(b"%PDF")
    monkeypatch.setattr(
        FileCompressor,
        "_convert_office_to_pdf",
        lambda *_a, **_k: str(converted),
        raising=True,
    )

    capture = {}
    monkeypatch.setattr(
        FileCompressor,
        "compress_pdf_file",
        lambda self, p, *a, **k: (
            capture.setdefault("in", p),
            _dummy_result(self, p, ft="pdf"),
        )[1],
        raising=True,
    )

    monkeypatch.setattr(
        compressor.mime,
        "from_file",
        lambda *_: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        raising=True,
    )

    res = compressor.compress_file(str(doc), str(tmp_path / "out"), doc.name)
    assert capture["in"] == str(converted) and res.file_type == "pdf"


def test_office_conversion_failure_fallback(monkeypatch, compressor, tmp_path):
    doc = tmp_path / "slides.pptx"
    doc.write_text("stub")
    monkeypatch.setattr(
        FileCompressor, "_convert_office_to_pdf", lambda *_a, **_k: None, raising=True
    )

    called = {}
    monkeypatch.setattr(
        FileCompressor,
        "compress_other_file",
        lambda self, *a, **k: (
            called.setdefault("o", True),
            _dummy_result(self, a[0], ft="other"),
        )[1],
        raising=True,
    )

    monkeypatch.setattr(
        compressor.mime,
        "from_file",
        lambda *_: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        raising=True,
    )

    res = compressor.compress_file(str(doc), str(tmp_path / "out"), doc.name)
    assert called.get("o") and res.file_type == "other"


def test_fallthrough_other_branch(monkeypatch, compressor, tiny):
    called = {}
    monkeypatch.setattr(
        FileCompressor,
        "compress_other_file",
        lambda self, *a, **k: (
            called.setdefault("o", True),
            _dummy_result(self, a[0], ft="other"),
        )[1],
        raising=True,
    )
    monkeypatch.setattr(
        compressor.mime, "from_file", lambda *_: "application/x-binary", raising=True
    )

    res = compressor.compress_file(str(tiny), str(tiny.parent), tiny.name)
    assert called.get("o") and res.file_type == "other"
