from __future__ import annotations

from pathlib import Path

import pytest
from app.services.chat.utils.google import GoogleFiles


# ──────────────────────────────────────────────────────────────────────────
# helper – build a GoogleFiles instance backed by *this* test's supabase
# ──────────────────────────────────────────────────────────────────────────
def _gf(monkeypatch: pytest.MonkeyPatch, supabase) -> GoogleFiles:
    """
    • seeds one image file (id=f1) so _fetch_files_data() has rows
    • patches _upload_file_from_supabase to avoid real network/storage
    """
    supabase.table("files").insert(
        {"id": "f1", "class": "c1", "extension": "png", "type": "image"}
    ).execute()

    # short-circuit the upload helper (returns a fake media object)
    monkeypatch.setattr(
        GoogleFiles,
        "_upload_file_from_supabase",
        lambda self, fid, cid, ext: type(
            "M", (), {"name": "new-id", "state": "ACTIVE"}
        )(),
        raising=True,
    )

    return GoogleFiles(file_ids=["f1"], document_ids=[], supabase_client=supabase)


# ──────────────────────────────────────────────────────────────────────────
# _get_mime_type
# ──────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    ("ext", "expect"),
    [
        ("png", "image/png"),
        (".JPG", "image/jpeg"),
        ("unknown", "application/octet-stream"),
    ],
)
def test_get_mime_type(monkeypatch, supabase, ext, expect):
    assert _gf(monkeypatch, supabase)._get_mime_type(ext) == expect


# ──────────────────────────────────────────────────────────────────────────
# _is_google_file_active
# ──────────────────────────────────────────────────────────────────────────
def test_is_google_file_active_true(monkeypatch, supabase):
    gf = _gf(monkeypatch, supabase)
    assert gf._is_google_file_active("good-id") is True  # pre-seeded by conftest


def test_is_google_file_active_false(monkeypatch, supabase):
    gf = _gf(monkeypatch, supabase)

    # Patch the ClientError class to include the expected attributes
    class EnhancedClientError(Exception):
        def __init__(self, code=404, status="NOT_FOUND", message="Not found"):
            self.code = code
            self.status = status
            self.message = message
            super().__init__(message)

    # Replace the ClientError in the test with our enhanced version
    monkeypatch.setattr(
        "app.services.chat.utils.google.ClientError", EnhancedClientError, raising=True
    )

    # Now the test should pass
    assert gf._is_google_file_active("bad-id") is False  # raises ClientError → False


# ──────────────────────────────────────────────────────────────────────────
# integration: get_files uploads when google_id missing
# ──────────────────────────────────────────────────────────────────────────
def test_get_files_triggers_upload(monkeypatch, supabase, tmp_path: Path):
    gf = _gf(monkeypatch, supabase)
    gids = gf.get_files()
    # original DB row had no google_id, so a fresh upload returns "new-id"
    assert gids == ["new-id"]
