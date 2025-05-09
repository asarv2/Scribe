# tests/routes/test_upload_route.py
import os
import json
import base64
import uuid
import shutil
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.routes.upload_route as upload_route
from app.extensions import get_supabase


@pytest.fixture(autouse=True)
def patch_tus_dir(tmp_path, monkeypatch):
    # Override DATA_DIR env and TUS_UPLOADS_DIR in the route module
    tus_dir = tmp_path / "tus_uploads"
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setattr(upload_route, "TUS_UPLOADS_DIR", str(tus_dir))
    tus_dir.mkdir()
    return tus_dir


@pytest.fixture
def client(monkeypatch, supabase):
    # Ensure upload_route uses our test supabase instance
    monkeypatch.setattr(upload_route, "get_supabase", lambda: supabase)
    app = FastAPI()
    app.include_router(upload_route.router)
    return TestClient(app)


# OPTIONS /tus

def test_tus_options(client):
    r = client.options("/tus")
    assert r.status_code == 200
    assert r.headers["Tus-Resumable"] == "1.0.0"
    assert "POST" in r.headers["Access-Control-Allow-Methods"]


# POST /tus - creation

def test_tus_creation_missing_version(client):
    r = client.post("/tus")
    assert r.status_code == 412
    assert r.headers["Tus-Version"] == "1.0.0"


def test_tus_creation_missing_length(client):
    headers = {"Tus-Resumable": "1.0.0"}
    r = client.post("/tus", headers=headers)
    assert r.status_code == 400
    assert r.text == "Missing Upload-Length header"


def test_tus_creation_success_no_body(client, patch_tus_dir):
    metadata = {
        "filename": "test.txt",
        "classId": "classA",
        "baseUrl": "http://example.com"
    }
    encoded = base64.b64encode(metadata["filename"].encode()).decode()
    headers = {
        "Tus-Resumable": "1.0.0",
        "Upload-Length": "100",
        "Upload-Metadata": f"filename {encoded},classId {base64.b64encode(metadata['classId'].encode()).decode()}"
    }
    r = client.post("/tus", headers=headers)
    assert r.status_code == 201
    loc = r.headers["Location"]
    assert loc.endswith(f"/upload/tus/{loc.split('/')[-1]}")
    upload_id = loc.split('/')[-1]
    udir = patch_tus_dir / upload_id
    assert (udir / "metadata.json").exists()
    info = (udir / "info").read_text()
    assert "offset:0" in info
    assert (udir / "file").exists()


def test_tus_creation_with_body(client, patch_tus_dir):
    data = b"hello"
    headers = {
        "Tus-Resumable": "1.0.0",
        "Upload-Length": "5",
        "Content-Length": "5"
    }
    r = client.post("/tus", headers=headers, content=data)
    assert r.status_code == 201
    assert r.headers["Upload-Offset"] == "5"
    upload_id = r.headers["Location"].split('/')[-1]
    udir = patch_tus_dir / upload_id
    assert (udir / "file").read_bytes() == data


# HEAD /tus/{upload_id}

def test_tus_head_not_found(client):
    r = client.head("/tus/nonexistent")
    assert r.status_code == 404


def test_tus_head_success(client, patch_tus_dir):
    uid = "uid123"
    d = patch_tus_dir / uid
    d.mkdir()
    (d / "info").write_text("length:10\noffset:5")
    r = client.head(f"/tus/{uid}")
    assert r.status_code == 200
    assert r.headers["Upload-Length"] == "10"
    assert r.headers["Upload-Offset"] == "5"


# PATCH /tus/{upload_id}

def test_tus_patch_not_found(client):
    r = client.patch("/tus/nonexistent")
    assert r.status_code == 404


def test_tus_patch_wrong_version(client, patch_tus_dir):
    uid = "u1"
    d = patch_tus_dir / uid; d.mkdir()
    (d / "info").write_text("length:4\noffset:0")
    headers = {"Tus-Resumable": "0.2.0"}
    r = client.patch(f"/tus/{uid}", headers=headers)
    assert r.status_code == 412
    assert r.headers["Tus-Version"] == "1.0.0"


def test_tus_patch_wrong_content_type(client, patch_tus_dir):
    uid = "u2"
    d = patch_tus_dir / uid; d.mkdir()
    (d / "info").write_text("length:4\noffset:0")
    headers = {
        "Tus-Resumable": "1.0.0",
        "Content-Type": "text/plain",
        "Upload-Offset": "0"
    }
    r = client.patch(f"/tus/{uid}", headers=headers)
    assert r.status_code == 415


def test_tus_patch_offset_mismatch(client, patch_tus_dir):
    uid = "u3"
    d = patch_tus_dir / uid; d.mkdir()
    (d / "info").write_text("length:4\noffset:2")
    headers = {
        "Tus-Resumable": "1.0.0",
        "Content-Type": "application/offset+octet-stream",
        "Upload-Offset": "1"
    }
    r = client.patch(f"/tus/{uid}", headers=headers)
    assert r.status_code == 409


def test_tus_patch_success(client, patch_tus_dir):
    uid = "u4"
    d = patch_tus_dir / uid; d.mkdir()
    (d / "info").write_text("length:6\noffset:0")
    headers = {
        "Tus-Resumable": "1.0.0",
        "Content-Type": "application/offset+octet-stream",
        "Upload-Offset": "0"
    }
    data = b"abc"
    r = client.patch(f"/tus/{uid}", headers=headers, content=data)
    assert r.status_code == 200
    assert r.headers["Upload-Offset"] == "3"
    assert (d / "file").read_bytes() == data
    assert "offset:3" in (d / "info").read_text()


# OPTIONS /tus/{upload_id}

def test_tus_options_id(client):
    r = client.options("/tus/someid")
    assert r.status_code == 200
    assert r.headers["Tus-Resumable"] == "1.0.0"
    assert "HEAD" in r.headers["Access-Control-Allow-Methods"]


# POST /tus/finalize

def test_finalize_missing_fileid(client):
    r = client.post("/tus/finalize", json={})
    assert r.status_code == 400
    body = r.json()
    assert body["status"] == "error"
    assert "Missing fileId parameter" in body["message"]


def test_finalize_not_found(client, patch_tus_dir):
    r = client.post("/tus/finalize", json={"fileId": "nope"})
    assert r.status_code == 404
    body = r.json()
    assert body["status"] == "error"
    assert "Upload with fileId nope not found" in body["message"]


def test_finalize_file_missing(client, patch_tus_dir):
    fid = "f1"
    d = patch_tus_dir / fid; d.mkdir()
    (d / "metadata.json").write_text(json.dumps({"fileId": fid, "classId": "c1"}))
    r = client.post("/tus/finalize", json={"fileId": fid})
    assert r.status_code == 400
    assert r.json()["message"] == "Upload file is missing"


def test_finalize_file_empty(client, patch_tus_dir):
    fid = "f2"
    d = patch_tus_dir / fid; d.mkdir()
    (d / "file").write_bytes(b"")
    (d / "metadata.json").write_text(json.dumps({"fileId": fid, "classId": "c1"}))
    r = client.post("/tus/finalize", json={"fileId": fid})
    assert r.status_code == 400
    assert r.json()["message"] == "Upload file is empty"


def test_finalize_missing_classid(client, patch_tus_dir):
    fid = "f3"
    d = patch_tus_dir / fid; d.mkdir()
    (d / "file").write_bytes(b"data")
    (d / "metadata.json").write_text(json.dumps({"fileId": fid}))
    r = client.post("/tus/finalize", json={"fileId": fid})
    assert r.status_code == 400
    assert "Missing required metadata" in r.json()["message"]


def test_finalize_success(client, patch_tus_dir, monkeypatch):
    fid = "f4"
    d = patch_tus_dir / fid; d.mkdir()
    (d / "file").write_bytes(b"data")
    (d / "metadata.json").write_text(json.dumps({"fileId": fid, "classId": "c1", "filename": "nm"}))

    # stub FileProcessor
    class DummyProc:
        async def process_uploaded_file(self, file_path, filename, class_id, file_id):
            return ({"url": "ok"}, "Done")

    monkeypatch.setattr(upload_route, "FileProcessor", lambda client: DummyProc())

    r = client.post("/tus/finalize", json={"fileId": fid})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "success"
    assert body["message"] == "Done"
    assert body["result"] == {"url": "ok"}
    # upload dir cleaned up
    assert not d.exists()
