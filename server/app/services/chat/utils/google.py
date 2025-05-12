from typing import List, Optional
from google.genai.types import File, UploadFileConfig
from google.genai.errors import APIError, ClientError, ServerError
import logging
import os
import traceback
import time
from app.extensions import get_google

logger = logging.getLogger(__name__)


class GoogleFiles:
    def __init__(
        self,
        file_ids: List[str],
        document_ids: List[str],
        supabase_client,
    ):
        """
        Initialize GoogleFiles with file IDs and fetch all necessary data from Supabase

        Args:
            file_ids: List[str] - The IDs of the files to process
            document_ids: List[str] - The IDs of the documents to process
            supabase_client - The Supabase client for database and storage operations
        """
        self.supabase = supabase_client
        self.google = get_google()

        # Fetch file + document metadata
        self.files_data = self._fetch_files_data(file_ids)
        self.documents_data = self._fetch_documents_data(document_ids)

    def _fetch_files_data(self, file_ids: List[str]) -> List[dict]:
        """Fetch file metadata and last Google ID (if any)."""
        if not file_ids:
            return []

        logger.info(f"Fetching meta for files {file_ids}")
        files_resp = (
            self.supabase.table("files")
            .select("id", "class", "type", "extension")
            .in_("id", file_ids)
            .execute()
        )
        if not files_resp.data:
            logger.warning(f"No files found for {file_ids}")
            return []

        # now grab the google-table PK too
        google_resp = (
            self.supabase.table("google")
            .select("id,file,google_id")
            .in_("file", file_ids)
            .order("created_at", desc=True)
            .execute()
        )

        # map file_id → (google_id, google_table_id)
        google_map = {}
        for rec in google_resp.data or []:
            fid = rec["file"]
            if fid not in google_map:
                google_map[fid] = {
                    "google_id": rec["google_id"],
                    "google_table_id": rec["id"],
                }

        out = []
        for f in files_resp.data:
            gm = google_map.get(f["id"], {})
            out.append(
                {
                    "file_id": f["id"],
                    "class_id": f["class"],
                    "extension": f["extension"],
                    "google_id": gm.get("google_id"),
                    "google_table_id": gm.get("google_table_id"),  # may be None
                }
            )
        return out

    def _fetch_documents_data(self, document_ids: List[str]) -> List[dict]:
        """Fetch document metadata plus the google‐table row ID if it exists."""
        if not document_ids:
            return []

        docs_resp = (
            self.supabase.table("documents")
            .select("id", "class", "file", "extension")
            .in_("id", document_ids)
            .execute()
        )
        if not docs_resp.data:
            logger.warning(f"No documents found for {document_ids}")
            return []

        # Grab both google_id and the google‐table PK
        google_resp = (
            self.supabase.table("google")
            .select("id,document,google_id")
            .in_("document", document_ids)
            .order("created_at", desc=True)
            .execute()
        )

        # map document → (google_id, google_table_id)
        google_map = {}
        for rec in google_resp.data or []:
            did = rec["document"]
            # only take the first (latest) record
            if did not in google_map:
                google_map[did] = {
                    "google_id": rec["google_id"],
                    "google_table_id": rec["id"],
                }

        out = []
        for d in docs_resp.data:
            gm = google_map.get(d["id"], {})
            out.append(
                {
                    "document_id": d["id"],
                    "file_id": d["file"],
                    "class_id": d["class"],
                    "extension": d["extension"],
                    "google_id": gm.get("google_id"),
                    "google_table_id": gm.get("google_table_id"),  # may be None
                }
            )
        return out

    def _is_google_file_active(self, google_id: str) -> bool:
        """Return True if the file exists on Google and is ACTIVE.
        On any permission, missing-file, or API error, return False → triggers reupload."""
        if not google_id:
            return False

        try:
            info = self.google.files.get(name=google_id)
            state = getattr(info.state, "name", info.state)
            return state == "ACTIVE"
        except ClientError as e:
            logger.warning(
                f"GenAI client error ({e.code} {e.status}); reuploading: {e.message}"
            )
            return False
        except ServerError as e:
            logger.warning(
                f"GenAI server error ({e.code}); treating as inactive: {e.message}"
            )
            return False
        except APIError as e:
            logger.warning(f"Other GenAI error ({e.code}); will reupload: {e.message}")
            return False
        except Exception as e:
            logger.warning(f"Unexpected error checking {google_id}: {e}")
            return False

    def get_files(self) -> List[Optional[str]]:
        """
        Return a list of Google IDs for all files,
        uploading any that don't exist or aren't ACTIVE.
        Returns None for files that couldn't be uploaded.
        """
        out_ids: List[Optional[str]] = []
        for meta in self.files_data:
            gid = meta.get("google_id")
            if not gid or not self._is_google_file_active(gid):
                logger.info(f"Uploading fresh copy of file {meta['file_id']}")
                media = self._upload_file_from_supabase(
                    meta["file_id"], meta["class_id"], meta["extension"]
                )
                if media:
                    gid = media.name
                else:
                    # If upload failed, set gid to None to indicate failure
                    logger.warning(f"Failed to upload file {meta['file_id']} to Google")
                    gid = None
            out_ids.append(gid)
        return out_ids

    def get_documents(self) -> List[str | None]:
        """
        Return a list of Google IDs for all documents,
        uploading any that don't exist or aren't ACTIVE.
        """
        out_ids: List[str | None] = []
        for meta in self.documents_data:
            gid = meta.get("google_id")
            if not gid or not self._is_google_file_active(gid):
                logger.info(f"Uploading fresh copy of document {meta['document_id']}")
                media = self._upload_document_from_supabase(
                    meta["file_id"],
                    meta["document_id"],
                    meta["class_id"],
                    meta["extension"],
                )
                if media:
                    gid = media.name
            out_ids.append(gid)
        return out_ids

    def _upload_file_from_supabase(
        self, file_id: str, class_id: str, extension: str
    ) -> Optional[File]:
        """Download a file from Supabase and upload it to Google."""
        temp_dir = os.path.join(os.getcwd(), "cache", "temp")
        os.makedirs(temp_dir, exist_ok=True)
        local_path = os.path.join(temp_dir, f"{file_id}.{extension}")

        # try download
        try:
            try:
                res = self.supabase.storage.from_("files").download(
                    f"{class_id}/{file_id}.{extension}"
                )
            except Exception:
                res = self.supabase.storage.from_("files").download(
                    f"{class_id}/{file_id}"
                )
            with open(local_path, "wb") as f:
                f.write(res)
        except Exception as e:
            logger.error(f"Download failed for {file_id}: {e}")
            logger.error(traceback.format_exc())
            return None

        mime_type = self._get_mime_type(extension)

        try:
            with open(local_path, "rb") as f:
                media = self.google.files.upload(
                    file=f, config=UploadFileConfig(mime_type=mime_type)
                )
            media = self._wait_for_file_activation(media)
            if not media:
                logger.error(f"Activation timeout for file {file_id}")
                return None
        except Exception as e:
            logger.error(f"Upload to Google failed for {file_id}: {e}")
            logger.error(traceback.format_exc())
            return None
        finally:
            try:
                os.remove(local_path)
            except OSError:
                pass

        # record in Supabase
        google_id = media.name

        # lookup the row‐PK we fetched earlier
        meta = next((m for m in self.files_data if m["file_id"] == file_id), {})
        pk = meta.get("google_table_id")

        try:
            if pk:
                # update existing record by primary key
                self.supabase.table("google").update({"google_id": google_id}).eq(
                    "id", pk
                ).execute()
            else:
                # insert and capture new PK
                resp = (
                    self.supabase.table("google")
                    .insert({"file": file_id, "google_id": google_id})
                    .execute()
                )
                new_pk = resp.data[0]["id"]
                meta["google_table_id"] = new_pk
        except Exception as e:
            logger.error(f"Error upserting google record for file {file_id}: {e}")
            logger.error(traceback.format_exc())

        return media

    def _upload_document_from_supabase(
        self, file_id: str, document_id: str, class_id: str, extension: str
    ) -> Optional[File]:
        """Download a document from Supabase (raw bytes) and upload it to Google."""
        temp_dir = os.path.join(os.getcwd(), "cache", "temp")
        os.makedirs(temp_dir, exist_ok=True)
        local_path = os.path.join(temp_dir, f"{document_id}.{extension}")

        # 1) Download from Supabase (returns bytes, or throws)
        try:
            try:
                data = self.supabase.storage.from_("files").download(
                    f"{class_id}/{file_id}/{document_id}.{extension}"
                )
            except Exception:
                data = self.supabase.storage.from_("files").download(
                    f"{class_id}/{file_id}/{document_id}"
                )

            # write raw bytes straight to disk
            with open(local_path, "wb") as f:
                f.write(data)

        except Exception as e:
            logger.error(f"Failed to download document {document_id}: {e}")
            logger.error(traceback.format_exc())
            return None

        # 2) Upload to Google
        mime_type = self._get_mime_type(extension)
        try:
            with open(local_path, "rb") as f:
                media = self.google.files.upload(
                    file=f, config=UploadFileConfig(mime_type=mime_type)
                )
            media = self._wait_for_file_activation(media)
            if not media:
                logger.error(f"{document_id} never became ACTIVE")
                return None

            google_id = media.name

            # find the metadata entry so we know the google_table_id
            meta = next(
                (m for m in self.documents_data if m["document_id"] == document_id), {}
            )
            pk = meta.get("google_table_id")

            try:
                if pk:
                    # update the existing row by its PK
                    self.supabase.table("google").update({"google_id": google_id}).eq(
                        "id", pk
                    ).execute()
                else:
                    # insert & capture the new PK
                    resp = (
                        self.supabase.table("google")
                        .insert({"document": document_id, "google_id": google_id})
                        .execute()
                    )
                    # resp.data[0]["id"] is the new row's PK
                    new_pk = resp.data[0]["id"]
                    meta["google_table_id"] = new_pk
            except Exception as e:
                logger.error(
                    f"Error upserting google record for doc {document_id}: {e}"
                )
                logger.error(traceback.format_exc())

            return media
        finally:
            try:
                os.remove(local_path)
            except OSError:
                pass

    def _get_mime_type(self, extension: str) -> str:
        """Map file extension to MIME type."""
        if not extension.startswith("."):
            extension = f".{extension}"
        ext = extension.lower()
        return {
            ".pdf": "application/pdf",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".mp4": "video/mp4",
            ".mov": "video/quicktime",
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".txt": "text/plain",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }.get(ext, "application/octet-stream")

    def _wait_for_file_activation(
        self, media: File, max_attempts: int = 10, base_delay: float = 0.5
    ) -> Optional[File]:
        """
        Poll until the Google file becomes ACTIVE.
        Exponential backoff between attempts.
        """
        file_id = media.name
        for attempt in range(max_attempts):
            try:
                info = self.google.files.get(name=file_id)
                state = getattr(info.state, "name", info.state)
                if state == "ACTIVE":
                    logger.info(f"{file_id} is ACTIVE after {attempt + 1} attempts")
                    return info
                if state == "FAILED":
                    logger.error(f"{file_id} processed FAILED")
                    return None

                wait = base_delay * (2**attempt)
                logger.info(
                    f"{file_id} not ACTIVE yet ({state}); retrying in {wait:.2f}s"
                )
                time.sleep(wait)
            except Exception as e:
                logger.warning(f"Check failed for {file_id}: {e}")
                time.sleep(base_delay * (2**attempt))
        logger.error(f"{file_id} never became ACTIVE")
        return None
