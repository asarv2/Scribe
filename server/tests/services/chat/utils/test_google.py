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


# ──────────────────────────────────────────────────────────────────────────
# _upload_file_from_supabase - error handling
# ──────────────────────────────────────────────────────────────────────────
def test_upload_file_from_supabase_storage_error(monkeypatch, supabase):
    """Test that _upload_file_from_supabase handles storage errors gracefully."""
    gf = _gf(monkeypatch, supabase)
    
    # First, undo the mock from _gf helper to restore the original method
    monkeypatch.undo()
    
    # Mock the storage.from_().download to raise a StorageApiError
    class MockStorageError(Exception):
        def __init__(self):
            self.message = "Object not found"
            self.error = "not_found"
            self.statusCode = 404
    
    def mock_download(*args, **kwargs):
        raise MockStorageError()
    
    monkeypatch.setattr(
        gf.supabase.storage.from_("files"), "download", mock_download, raising=True
    )
    
    # Call the method and verify it returns None on storage error
    result = gf._upload_file_from_supabase("missing-file", "c1", "pdf")
    assert result is None
    
    # Test that get_files handles this gracefully
    # First, modify our test instance to have a file that will fail to download
    gf.files_data = [{"file_id": "missing-file", "class_id": "c1", "extension": "pdf"}]
    
    # The method should return None for the missing file
    assert gf.get_files() == [None]
