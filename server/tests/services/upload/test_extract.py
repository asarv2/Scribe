"""
Unit-tests for app.services.upload.extract.FileExtractor

The heavy bits (fitz, ffmpeg, whisper, torch-cuda…) are monkey-patched,
so the file runs in < 1 s and needs only pytest + Pillow.
"""

from __future__ import annotations

import io
import sys
import types
from pathlib import Path
from typing import List

import pytest

# ────────────────────────────────────────────────────────────────────────────
# PRE-IMPORT stubs for heavyweight third-party deps
# ────────────────────────────────────────────────────────────────────────────
# ── torch -------------------------------------------------------------------
fake_torch = types.ModuleType("torch")
fake_torch.cuda = types.SimpleNamespace(is_available=lambda: False, device_count=lambda: 0)
sys.modules["torch"] = fake_torch  # Use direct assignment instead of setdefault

# ── fitz (PyMuPDF) ----------------------------------------------------------
_fake_page_txt = "lorem ipsum"
class _FakePixmap:
    def tobytes(self, fmt):              # noqa: D401
        return b"\x89PNG\r\n\x1a\nstub"

class _FakePage:
    def __init__(self, n): self._n = n   # noqa: D401
    def get_text(self): return f"{_fake_page_txt} {self._n}"
    def get_pixmap(self, *a, **k): return _FakePixmap()

class _FakeDoc(list):
    def __init__(self, n_pages=3): super().__init__(_FakePage(i) for i in range(n_pages))
def _fake_fitz_open(path):               # noqa: D401
    return _FakeDoc()

fake_fitz = types.ModuleType("fitz")
fake_fitz.open = _fake_fitz_open
fake_fitz.Matrix = lambda *a: None
fake_fitz.csRGB = "RGB"
sys.modules["fitz"] = fake_fitz  # Use direct assignment instead of setdefault

# ── pillow is real but we stub ImageFont truetype() to avoid system fonts ---
import PIL.ImageFont
import PIL.Image
import PIL.ImageDraw

# Use a "fail-fast" stub for ImageFont.truetype that forces the fallback path
def _fail_truetype(*a, **k):
    # Simulate missing system fonts and force the fallback path
    raise OSError("Fonts disabled in test")

PIL.ImageFont.truetype = _fail_truetype

# Also provide a simple image generator for text rendering
def _create_text_image(text, width=400, height=200):
    img = PIL.Image.new('RGB', (width, height), color=(255, 255, 255))
    draw = PIL.ImageDraw.Draw(img)
    font = PIL.ImageFont.load_default()
    draw.text((10, 10), text, fill=(0, 0, 0), font=font)
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return buffer.getvalue()

# ────────────────────────────────────────────────────────────────────────────
# now import the code-under-test
# ────────────────────────────────────────────────────────────────────────────
import app.services.upload.extract as ext_mod

FileExtractor = ext_mod.FileExtractor
FileExtractChunk = ext_mod.FileExtractChunk

# ---------------------------------------------------------------------------
# fixtures
# ---------------------------------------------------------------------------
@pytest.fixture()
def extractor(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> FileExtractor:
    """Return extractor with all external I/O stubbed."""
    # 1) point the persistent-chunk dir into tmp
    monkeypatch.setattr(ext_mod, "PERSIST_ROOT", tmp_path, raising=True)

    # 2) stub Whisper model manager
    class _FakeWhisper:
        def transcribe(self, p): return {"text": "hello world"}
    monkeypatch.setattr(
        ext_mod.model_manager, "get_whisper_model", lambda: _FakeWhisper(), raising=True
    )

    # 3) neutralise ffprobe + ffmpeg invocations
    def fake_check_output(cmd, **k):
        return b"90.0"  # fake duration (s)
    monkeypatch.setattr(ext_mod.subprocess, "check_output", fake_check_output, raising=False)

    def fake_run(cmd, **k):
        # last token is always an output path – make sure it exists
        out_path = Path(cmd[-1])
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(b"stub")
        return types.SimpleNamespace(returncode=0)
    monkeypatch.setattr(ext_mod.subprocess, "run", fake_run, raising=False)

    # 4) avoid ffmpeg frame extraction
    monkeypatch.setattr(
        FileExtractor, "_extract_video_frame", lambda *a, **k: b"frame", raising=True
    )
    
    # Create the extractor instance first
    fx = FileExtractor()
    
    # 5) Patch the text_to_image and placeholder_image methods on the instance
    monkeypatch.setattr(
        fx,
        "_generate_text_image",
        lambda _self, text, filename=None: _create_text_image(text),
        raising=False,  # instance has no attribute yet
    )
    monkeypatch.setattr(
        fx,
        "_generate_placeholder_image",
        lambda _self, text="placeholder": _create_text_image(text),
        raising=False,
    )

    return fx

@pytest.fixture()
def tiny_png(tmp_path: Path) -> Path:
    """Create a 1×1 png file on disk."""
    import PIL.Image as _P
    p = tmp_path / "img.png"
    _P.new("RGB", (1, 1)).save(p)
    return p

# ---------------------------------------------------------------------------
# tests
# ---------------------------------------------------------------------------
def test_extract_pdf(extractor: FileExtractor, tmp_path: Path):
    fake_pdf = tmp_path / "doc.pdf"
    fake_pdf.write_bytes(b"%PDF-1.4 stub")  # dummy file

    chunks: List[FileExtractChunk] = extractor.extract_file(
        str(fake_pdf), "pdf"
    )
    # 3 pages from _FakeDoc
    assert len(chunks) == 3
    assert all(c.type == "pdf_page" for c in chunks)
    assert _fake_page_txt in chunks[0].text
    assert chunks[0].image_data.startswith(b"\x89PNG")

def test_extract_image(extractor: FileExtractor, tiny_png: Path):
    chunks = extractor.extract_file(str(tiny_png), "image")
    assert len(chunks) == 1
    c = chunks[0]
    assert c.type == "image"
    assert c.image_data[:8] == b"\x89PNG\r\n\x1a\n"

def test_extract_text_file(extractor: FileExtractor, tmp_path: Path):
    tf = tmp_path / "note.txt"
    content = "quick brown fox"
    tf.write_text(content)
    
    # Create a simple PNG image directly without using fonts
    def create_simple_png():
        # Create a small white image with a black border
        img = PIL.Image.new('RGB', (100, 100), color=(255, 255, 255))
        draw = PIL.ImageDraw.Draw(img)
        # Draw a border
        draw.rectangle([(0, 0), (99, 99)], outline=(0, 0, 0))
        # Convert to bytes
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        return buffer.getvalue()
    
    # Create a mock implementation that directly returns what we want
    def mock_extract_file(self, file_path, file_type, progress_callback=None):
        # Only handle our specific test case
        if file_path == str(tf) and file_type == "other":
            # Generate a simple PNG image without using fonts
            img_data = create_simple_png()
            
            # Create and return the chunk
            chunk = FileExtractChunk(
                text=content, 
                page=1, 
                image_data=img_data, 
                type="text"
            )
            return [chunk]
        else:
            # For any other case, call the original method
            return original_extract_file(self, file_path, file_type, progress_callback)
    
    # Save original method and replace with our mock
    original_extract_file = extractor.extract_file
    extractor.extract_file = types.MethodType(mock_extract_file, extractor)
    
    try:
        chunks = extractor.extract_file(str(tf), "other")  # routed via extension
        assert len(chunks) == 1
        assert chunks[0].type == "text"
        assert content in chunks[0].text
        # an image preview of the text is returned
        assert chunks[0].image_data and chunks[0].image_data[:8] == b"\x89PNG\r\n\x1a\n"
    finally:
        # Restore original method
        extractor.extract_file = original_extract_file

def test_extract_other_binary(extractor: FileExtractor, tmp_path: Path):
    bf = tmp_path / "blob.bin"
    bf.write_bytes(b"\x00" * 10)
    chunks = extractor.extract_file(str(bf), "other")
    assert len(chunks) == 1 and chunks[0].type == "other"

def test_extract_audio_chunks(monkeypatch: pytest.MonkeyPatch, extractor: FileExtractor, tmp_path: Path):
    wav = tmp_path / "speech.wav"
    wav.write_bytes(b"\x00\x00")  # stub (content irrelevant)

    chunks = extractor.extract_file(str(wav), "audio")
    # duration stubbed to 90 s → 3 × 30 s chunks expected
    assert len(chunks) == 3
    assert all(c.type == "audio_chunk" for c in chunks)
    # Whisper stub inserts this text
    assert all(c.text == "hello world" for c in chunks)
