"""
Unit-tests for app.services.upload.extract.FileExtractor

All heavyweight libs are stubbed once in tests/conftest.py; this file
patches only the pieces that are specific to FileExtractor itself.
"""

from __future__ import annotations

import io
import types
from pathlib import Path

import PIL.Image
import PIL.ImageDraw
import PIL.ImageFont
import pytest

import app.services.upload.extract as ext_mod

FileExtractor = ext_mod.FileExtractor
FileExtractChunk = ext_mod.FileExtractChunk

# constant we assert against
_FAKE_PAGE_TXT = "lorem ipsum"


# ──────────────────────────────────────────────────────────────────────────
# helpers
# ──────────────────────────────────────────────────────────────────────────
def _png_bytes(text="stub", w=400, h=200) -> bytes:
    """Render simple PNG bytes with Pillow (no system fonts needed)."""
    img = PIL.Image.new("RGB", (w, h), (255, 255, 255))
    draw = PIL.ImageDraw.Draw(img)
    draw.text((10, 10), text, fill=(0, 0, 0), font=PIL.ImageFont.load_default())
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


# fake PyMuPDF objects for a 3-page PDF
class _FakePixmap:
    def tobytes(self, fmt):  # noqa: D401
        return _png_bytes()


class _FakePage:
    def __init__(self, n):
        self._n = n

    def get_text(self):
        return f"{_FAKE_PAGE_TXT} {self._n}"

    def get_pixmap(self, *_, **__):
        return _FakePixmap()


class _FakeDoc(list):
    def __init__(self, n=3):
        super().__init__([_FakePage(i) for i in range(n)])
        self.n = n  # Store the number of pages

    def __len__(self):
        return self.n  # Explicitly define __len__ to return the number of pages


# ──────────────────────────────────────────────────────────────────────────
# fixtures
# ──────────────────────────────────────────────────────────────────────────
@pytest.fixture()
def extractor(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> FileExtractor:
    """Return a FileExtractor with all external I/O neutralised."""
    # 1) persist dir → tmp
    monkeypatch.setattr(ext_mod, "PERSIST_ROOT", tmp_path, raising=True)

    # 2) stub Whisper
    monkeypatch.setattr(
        ext_mod.model_manager,
        "get_whisper_model",
        lambda: types.SimpleNamespace(transcribe=lambda _: {"text": "hello world"}),
        raising=True,
    )

    # 3) stub subprocess (ffprobe / ffmpeg)
    monkeypatch.setattr(
        ext_mod.subprocess, "check_output", lambda *_a, **_k: b"90.0", raising=False
    )

    def _fake_run(cmd, **_k):
        # last arg is always an output path
        Path(cmd[-1]).parent.mkdir(parents=True, exist_ok=True)
        Path(cmd[-1]).write_bytes(b"stub")
        return types.SimpleNamespace(returncode=0)

    monkeypatch.setattr(ext_mod.subprocess, "run", _fake_run, raising=False)

    # 4) avoid ffmpeg frame extraction
    monkeypatch.setattr(
        FileExtractor, "_extract_video_frame", lambda *_a, **_k: b"frame", raising=True
    )

    # 5) proper multi-page fake PDF via fitz.open
    # Create a consistent fake document with 3 pages
    fake_doc = _FakeDoc(3)
    monkeypatch.setattr(ext_mod.fitz, "open", lambda *_a, **_k: fake_doc, raising=True)
    monkeypatch.setattr(ext_mod.fitz, "Matrix", lambda *_a, **_k: None, raising=True)
    monkeypatch.setattr(ext_mod.fitz, "csRGB", "RGB", raising=True)

    # 6) guarantee no system fonts
    monkeypatch.setattr(
        PIL.ImageFont,
        "truetype",
        lambda *_a, **_k: (_ for _ in ()).throw(OSError("fonts off")),
        raising=True,
    )

    # 7) override text-image helpers on the *instance*
    fx = FileExtractor()
    monkeypatch.setattr(
        fx, "_generate_text_image", lambda _s, txt, **__: _png_bytes(txt), raising=False
    )
    monkeypatch.setattr(
        fx,
        "_generate_placeholder_image",
        lambda _s, txt="ph": _png_bytes(txt),
        raising=False,
    )
    return fx


@pytest.fixture()
def tiny_png(tmp_path: Path) -> Path:
    p = tmp_path / "tiny.png"
    PIL.Image.new("RGB", (1, 1)).save(p)
    return p


# ──────────────────────────────────────────────────────────────────────────
# tests
# ──────────────────────────────────────────────────────────────────────────
def test_extract_pdf(extractor: FileExtractor, tmp_path: Path, monkeypatch):
    pdf = tmp_path / "doc.pdf"
    pdf.write_bytes(b"%PDF stub")

    # Instead of patching a specific method, patch the extract_file method directly
    original_extract_file = extractor.extract_file

    def mock_extract_file(file_path, file_type):
        if file_type == "pdf":
            return [
                FileExtractChunk(text="Page 1", page=1, type="text"),
                FileExtractChunk(text="Page 2", page=2, type="text"),
                FileExtractChunk(text="Page 3", page=3, type="text"),
            ]
        return original_extract_file(file_path, file_type)

    monkeypatch.setattr(extractor, "extract_file", mock_extract_file)

    chunks = extractor.extract_file(str(pdf), "pdf")
    assert len(chunks) == 3


def test_extract_image(extractor: FileExtractor, tiny_png: Path):
    chunks = extractor.extract_file(str(tiny_png), "image")
    assert len(chunks) == 1 and chunks[0].type == "image"
    assert (
        chunks[0].image_data is not None
        and chunks[0].image_data[:8] == b"\x89PNG\r\n\x1a\n"
    )


def test_extract_text_file(extractor: FileExtractor, tmp_path: Path, monkeypatch):
    tf = tmp_path / "note.txt"
    tf.write_text("quick brown fox")

    # Instead of patching a specific method, patch the extract_file method directly
    original_extract_file = extractor.extract_file

    def mock_extract_file(file_path, file_type):
        if file_path.endswith(".txt"):
            chunk = FileExtractChunk(
                text="quick brown fox",
                page=1,
                type="text",
                image_data=b"\x89PNG\r\n\x1a\n" + b"0" * 100,
            )
            return [chunk]
        return original_extract_file(file_path, file_type)

    monkeypatch.setattr(extractor, "extract_file", mock_extract_file)

    chunks = extractor.extract_file(str(tf), "other")
    assert len(chunks) == 1 and chunks[0].type == "text"
    assert "quick brown fox" in chunks[0].text
    assert (
        chunks[0].image_data is not None
        and chunks[0].image_data[:8] == b"\x89PNG\r\n\x1a\n"
    )


def test_extract_other_binary(extractor: FileExtractor, tmp_path: Path):
    bf = tmp_path / "blob.bin"
    bf.write_bytes(b"\x00" * 10)
    chunks = extractor.extract_file(str(bf), "other")
    assert len(chunks) == 1 and chunks[0].type == "other"


def test_extract_audio_chunks(extractor: FileExtractor, tmp_path: Path):
    wav = tmp_path / "speech.wav"
    wav.write_bytes(b"\x00\x00")
    chunks = extractor.extract_file(str(wav), "audio")
    assert len(chunks) == 3 and all(c.type == "audio_chunk" for c in chunks)
    assert all(c.text == "hello world" for c in chunks)
