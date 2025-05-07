# tests/services/upload/test_compress.py
"""
Unit-tests for app.services.upload.compress.FileCompressor

These tests never touch the network, GPUs, LibreOffice, FFmpeg, Torch, or
python-magic.  All heavyweight externals are stubbed so the whole file runs
offline in < 1 s.

Branches covered
────────────────
✓ video → compress_video_file  
✓ audio → compress_audio_file  
✓ PDF   → compress_pdf_file  
✓ Office → _convert_office_to_pdf  (success & failure paths)  
✓ fall-through → compress_other_file
"""

from __future__ import annotations

import sys
import types
from pathlib import Path
from types import SimpleNamespace

import pytest

# ────────────────────────────────────────────────────────────────────────────
# PRE-IMPORT stubs for *mandatory* third-party deps that might be missing
# ────────────────────────────────────────────────────────────────────────────
fake_torch = types.ModuleType("torch")
fake_torch.cuda = SimpleNamespace(is_available=lambda: False, device_count=lambda: 0)
sys.modules.setdefault("torch", fake_torch)

fake_magic = types.ModuleType("magic")


class _FakeMagic:
    def __init__(self, mime=True) -> None:  # noqa: D401
        self._mime = mime
        # the actual mime is injected per-test via monkeypatch

    def from_file(self, path: str) -> str:  # noqa: D401
        return "application/octet-stream"


fake_magic.Magic = _FakeMagic
sys.modules.setdefault("magic", fake_magic)

fake_fitz = types.ModuleType("fitz")
fake_fitz.open = lambda *a, **k: []  # minimal iterable
sys.modules.setdefault("fitz", fake_fitz)

# ────────────────────────────────────────────────────────────────────────────
# now it is safe to import the code under test
# ────────────────────────────────────────────────────────────────────────────
import app.services.upload.compress as compress_mod

FileCompressor = compress_mod.FileCompressor
FileCompressionResult = compress_mod.FileCompressionResult

# ────────────────────────────────────────────────────────────────────────────
# helpers
# ────────────────────────────────────────────────────────────────────────────
def _dummy_result(self, path: str, *, ft: str) -> FileCompressionResult:  # noqa: D401
    """Return a minimal but valid FileCompressionResult."""
    return self._create_result(path, file_length=0, file_type=ft)


# ---------------------------------------------------------------------------
# pytest fixtures
# ---------------------------------------------------------------------------
@pytest.fixture()
def compressor(monkeypatch: pytest.MonkeyPatch) -> FileCompressor:
    """Return a fresh compressor with its internal Magic stubbed."""
    c = FileCompressor()
    # make sure mime sniffer points somewhere – will be patched inside tests
    monkeypatch.setattr(c.mime, "from_file", lambda p: "application/octet-stream")
    # stub out duration to avoid ffprobe / subprocess
    monkeypatch.setattr(FileCompressor, "get_media_duration", lambda *a, **k: 42.0)
    return c


@pytest.fixture()
def temp_file(tmp_path: Path) -> Path:
    """Create a tiny placeholder file and return its path."""
    f = tmp_path / "input.bin"
    f.write_bytes(b"\x00" * 128)
    return f


# ---------------------------------------------------------------------------
# branch tests
# ---------------------------------------------------------------------------
def test_video_branch(monkeypatch: pytest.MonkeyPatch, compressor: FileCompressor, temp_file: Path):  # noqa: D401
    calls: dict[str, bool] = {}

    def fake_video(self, *a, **k):
        calls["video_called"] = True
        return _dummy_result(self, "compressed.mp4", ft="video")

    monkeypatch.setattr(
        FileCompressor, "compress_video_file", fake_video, raising=True
    )
    monkeypatch.setattr(
        compressor.mime, "from_file", lambda p: "video/mp4", raising=True
    )

    out_dir = temp_file.parent / "out"
    res = compressor.compress_file(str(temp_file), str(out_dir), temp_file.name)

    assert calls.get("video_called") is True
    assert res.file_type == "video"
    assert res.file_path.endswith(".mp4")


def test_audio_branch(monkeypatch: pytest.MonkeyPatch, compressor: FileCompressor, temp_file: Path):  # noqa: D401
    calls = {}

    def fake_audio(self, *a, **k):
        calls["audio_called"] = True
        return _dummy_result(self, "compressed.wav", ft="audio")

    monkeypatch.setattr(
        FileCompressor, "compress_audio_file", fake_audio, raising=True
    )
    monkeypatch.setattr(
        compressor.mime, "from_file", lambda p: "audio/mpeg", raising=True
    )

    res = compressor.compress_file(str(temp_file), str(temp_file.parent), "song.mp3")

    assert calls.get("audio_called") is True
    assert res.file_type == "audio"
    assert res.file_path.endswith(".wav")


def test_pdf_branch(monkeypatch: pytest.MonkeyPatch, compressor: FileCompressor, temp_file: Path):  # noqa: D401
    calls = {}

    def fake_pdf(self, *a, **k):
        calls["pdf_called"] = True
        return _dummy_result(self, a[0], ft="pdf")  # keep input path

    monkeypatch.setattr(
        FileCompressor, "compress_pdf_file", fake_pdf, raising=True
    )
    monkeypatch.setattr(
        compressor.mime, "from_file", lambda p: "application/pdf", raising=True
    )

    res = compressor.compress_file(str(temp_file), str(temp_file.parent), "doc.pdf")

    assert calls.get("pdf_called") is True
    assert res.file_type == "pdf"


def test_office_conversion_success(
    monkeypatch: pytest.MonkeyPatch, compressor: FileCompressor, tmp_path: Path
):  # noqa: D401
    # ── arrange
    doc_path = tmp_path / "report.docx"
    doc_path.write_text("stub")
    converted = tmp_path / "report.pdf"
    converted.write_bytes(b"%PDF-1.4\n")

    calls = {}

    # fake converter returns the new PDF
    monkeypatch.setattr(
        FileCompressor,
        "_convert_office_to_pdf",
        lambda *a, **k: str(converted),
        raising=True,
    )

    def fake_pdf(self, input_path, *a, **k):
        calls["pdf_input"] = input_path
        return _dummy_result(self, input_path, ft="pdf")

    monkeypatch.setattr(
        FileCompressor, "compress_pdf_file", fake_pdf, raising=True
    )

    monkeypatch.setattr(
        compressor.mime,
        "from_file",
        lambda p: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # noqa: E501
        raising=True,
    )

    # ── act
    res = compressor.compress_file(str(doc_path), str(tmp_path / "out"), doc_path.name)

    # ── assert
    assert calls["pdf_input"] == str(converted)  # path was swapped
    assert res.file_type == "pdf"


def test_office_conversion_failure_falls_back_to_other(
    monkeypatch: pytest.MonkeyPatch, compressor: FileCompressor, tmp_path: Path
):  # noqa: D401
    doc_path = tmp_path / "slides.pptx"
    doc_path.write_text("stub")

    # converter fails (returns None)
    monkeypatch.setattr(
        FileCompressor,
        "_convert_office_to_pdf",
        lambda *a, **k: None,
        raising=True,
    )

    calls = {}

    def fake_other(self, *a, **k):
        calls["other_called"] = True
        return _dummy_result(self, a[0], ft="other")

    monkeypatch.setattr(
        FileCompressor, "compress_other_file", fake_other, raising=True
    )

    monkeypatch.setattr(
        compressor.mime,
        "from_file",
        lambda p: "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # noqa: E501
        raising=True,
    )

    res = compressor.compress_file(str(doc_path), str(tmp_path / "out"), doc_path.name)

    assert calls.get("other_called") is True
    assert res.file_type == "other"


def test_fallthrough_other_branch(
    monkeypatch: pytest.MonkeyPatch, compressor: FileCompressor, temp_file: Path
):  # noqa: D401
    calls = {}

    def fake_other(self, *a, **k):
        calls["called"] = True
        return _dummy_result(self, a[0], ft="other")

    monkeypatch.setattr(
        FileCompressor, "compress_other_file", fake_other, raising=True
    )
    monkeypatch.setattr(
        compressor.mime, "from_file", lambda p: "application/x-binary", raising=True
    )

    res = compressor.compress_file(str(temp_file), str(temp_file.parent), "blob.bin")

    assert calls["called"] is True
    assert res.file_type == "other"
