# tests/conftest.py
from __future__ import annotations
import sys
import types
import pathlib
import random
import time
import pytest


###########################################################################
# 1.  ─── Tiny in-memory Supabase fake ────────────────────────────────────
###########################################################################
class _FakeResult:
    def __init__(self, data=None):
        self.data = data or []


class _FakeTable:
    def __init__(self, store: list[dict]):  # shared list per table-name
        self._store, self._pend, self._query = store, None, None

    # minimal INSERT / UPSERT / UPDATE / SELECT API
    def insert(self, rows):
        self._pend = rows if isinstance(rows, list) else [rows]
        return self

    upsert = insert  # same behaviour for tests

    def update(self, patch):
        self._patch = patch
        return self

    def select(self, *_):
        return self

    def eq(self, k, v):
        self._query = (k, v)
        return self

    def in_(self, k, vals):
        self._query = (k, set(vals))
        return self

    def order(self, *_, **__):
        return self

    def or_(self, *_):
        return self  # not needed in unit tests

    def execute(self):
        # commit pending inserts
        if self._pend is not None:
            for item in self._pend:
                # Make a deep copy to avoid reference issues
                self._store.append(dict(item))
            result = _FakeResult(self._pend)
            self._pend = None
            return result

        # apply update
        if hasattr(self, "_patch"):
            k, v = self._query
            touched = [r for r in self._store if r.get(k) == v]
            for r in touched:
                r.update(self._patch)
            return _FakeResult(touched)

        # naive WHERE / IN
        if self._query:
            k, v = self._query
            data = (
                [r for r in self._store if r.get(k) in v]
                if isinstance(v, set)
                else [r for r in self._store if r.get(k) == v]
            )
            return _FakeResult(data)

        # "SELECT *"
        return _FakeResult(list(self._store))


class _FakeStorage:
    class _Bucket:
        def __init__(self):
            self.uploads = {}  # Store uploaded files

        def download(self, *_):
            return b"dummy"

        def upload(self, path, file, file_options=None):
            # Handle both file-like objects and bytes
            if hasattr(file, "read"):
                content = file.read()
                # Reset file pointer if it's a file-like object
                if hasattr(file, "seek"):
                    file.seek(0)
            else:
                content = file

            self.uploads[path] = content
            return {"Key": path}

    def __init__(self):
        self._buckets = {}

    def from_(self, bucket_name):
        if bucket_name not in self._buckets:
            self._buckets[bucket_name] = self._Bucket()
        return self._buckets[bucket_name]


class _FakeSupabase:
    def __init__(self) -> None:
        self._tables: dict[str, list[dict]] = {}
        self.storage = _FakeStorage()

        # Add auto-incrementing ID for tables
        self._next_id = 1

    def table(self, name: str):
        self._tables.setdefault(name, [])
        table = _FakeTable(self._tables[name])

        # Add special handling for tables that need auto-generated IDs
        if name in ["documents", "figures", "questions", "reports", "summaries"]:
            original_execute = table.execute

            def patched_execute():
                if table._pend is not None:
                    for row in (
                        table._pend if isinstance(table._pend, list) else [table._pend]
                    ):
                        if "id" not in row:
                            row["id"] = (
                                f"{name[:-1]}_{self._next_id}"  # Remove 's' from end
                            )
                            self._next_id += 1
                return original_execute()

            setattr(table, "execute", patched_execute)

        return table


###########################################################################
# 2.  ─── Stub Google Gemini client & error classes ───────────────────────
###########################################################################
class _BaseErr(Exception):
    def __init__(self, code=0, status="", msg=""):
        self.code = code
        self.status = status
        self.message = msg
        super().__init__(msg)


ClientError = type("ClientError", (_BaseErr,), {})
ServerError = type("ServerError", (_BaseErr,), {})
APIError = type("APIError", (_BaseErr,), {})


class _FakeMedia:  # object returned by files.upload/get
    def __init__(self, name, state="ACTIVE"):
        self.name, self.state = name, state


class _FakeFilesAPI:
    def __init__(self):
        self._store = {
            "good-id": _FakeMedia("good-id"),
            "gid_audio": _FakeMedia("gid_audio"),
            "gid_pdf": _FakeMedia("gid_pdf"),
            "gid_d3": _FakeMedia("gid_d3"),
            "gid_img": _FakeMedia("gid_img"),
        }

    def get(self, name):
        if name in self._store:
            return self._store[name]
        raise ClientError(404, "NOT_FOUND", f"{name} not found")

    def upload(self, *, file, config):
        gid = f"gid_{int(time.time() * 1000)}_{random.randint(0, 999)}"
        self._store[gid] = _FakeMedia(gid)
        return self._store[gid]


class _FakeCachesAPI:
    def __init__(self):
        self._caches = {}

    def get(self, name):  # pretend caches live 60 s
        if name in self._caches:
            return self._caches[name]
        raise ClientError(404, "NOT_FOUND", name)

    def create(self, **_):
        cname = f"cache_{len(self._caches) + 1}"
        meta = types.SimpleNamespace(total_token_count=1234)
        cache = types.SimpleNamespace(
            name=cname,
            expire_time=types.SimpleNamespace(timestamp=lambda: time.time() + 60),
            usage_metadata=meta,
        )
        self._caches[cname] = cache
        return cache


class _FakeModelsAPI:  # just returns a small count
    def count_tokens(self, *_, **__):
        return 42


class _FakeGoogleClient:
    def __init__(self):
        self.files = _FakeFilesAPI()
        self.caches = _FakeCachesAPI()
        self.models = _FakeModelsAPI()


# build the google.genai import tree once, before any app code is imported
_google_pkg = types.ModuleType("google")
_genai_pkg = types.ModuleType("google.genai")
setattr(_genai_pkg, "files", _FakeFilesAPI())
_errs = types.ModuleType("google.genai.errors")
for _n, _c in {
    "ClientError": ClientError,
    "ServerError": ServerError,
    "APIError": APIError,
}.items():
    setattr(_errs, _n, _c)
setattr(_genai_pkg, "errors", _errs)
_types_mod = types.ModuleType("google.genai.types")


class UploadFileConfig:
    def __init__(self, **kw):
        self.__dict__.update(kw)


setattr(_types_mod, "UploadFileConfig", UploadFileConfig)
for _m in (_google_pkg, _genai_pkg, _errs, _types_mod):
    sys.modules[_m.__name__] = _m
setattr(_google_pkg, "genai", _genai_pkg)  # parent→child link

###########################################################################
# 3.  ─── Cheap stubs for heavyweight libs (`torch`, `fitz`, `magic`) ─────
###########################################################################
_stub_heavies = {
    "torch": lambda: types.ModuleType("torch").setattr(
        "cuda",
        types.SimpleNamespace(is_available=lambda: False, device_count=lambda: 0),
    )
    or sys.modules.get("torch"),
    "fitz": lambda: types.ModuleType("fitz")
    .setattr("open", lambda *a, **k: [])
    .setattr("Matrix", lambda *a, **k: None)
    .setattr("csRGB", "RGB")
    or sys.modules.get("fitz"),
    "magic": lambda: types.ModuleType("magic").setattr(
        "Magic",
        lambda *a, **k: types.SimpleNamespace(
            from_file=lambda _: "application/octet-stream"
        ),
    )
    or sys.modules.get("magic"),
}


# Helper to set attributes on modules
def _set_module_attrs(module, **attrs):
    for name, value in attrs.items():
        setattr(module, name, value)
    return module


# Create proper module objects
for _mod_name, _fn in _stub_heavies.items():
    if _mod_name not in sys.modules:
        mod = types.ModuleType(_mod_name)
        if _mod_name == "torch":
            cuda_mod = types.ModuleType(f"{_mod_name}.cuda")
            setattr(cuda_mod, "is_available", lambda: False)
            setattr(cuda_mod, "device_count", lambda: 0)
            setattr(mod, "cuda", cuda_mod)
        elif _mod_name == "fitz":
            setattr(mod, "open", lambda *a, **k: [])
            setattr(mod, "Matrix", lambda *a, **k: None)
            setattr(mod, "csRGB", "RGB")
        elif _mod_name == "magic":
            magic_cls = type(
                "Magic",
                (),
                {
                    "__init__": lambda self, *a, **k: None,
                    "from_file": lambda self, _: "application/octet-stream",
                },
            )
            setattr(mod, "Magic", magic_cls)
        sys.modules[_mod_name] = mod

###########################################################################
# 4.  ─── Patch / create `app.extensions` early ---------------------------
###########################################################################
if "app.extensions" in sys.modules:
    _ext = sys.modules["app.extensions"]
else:
    _ext = types.ModuleType("app.extensions")
    sys.modules["app.extensions"] = _ext

# harmless paths some helpers import at module level
for _name in (
    "SUMMARIES_DIR",
    "FIGURES_DIR",
    "QUESTIONS_DIR",
    "GRADES_DIR",
    "CHUNKS_DIR",
    "UPLOAD_FOLDER",
    "MODEL_CACHE_DIR",
):
    setattr(_ext, _name, pathlib.Path("/tmp"))

# Add the missing get_* functions that are imported at module level
setattr(_ext, "get_supabase", lambda: _FakeSupabase())
setattr(_ext, "get_google", lambda: _FakeGoogleClient())
setattr(_ext, "get_gemini", lambda: None)  # Add if needed


# Create a fake LitellmModel with the required model attribute
class _FakeLitellmModel:
    def __init__(self):
        self.model = "gemini/gemini-1.5-flash-002"

    async def acompletion(self, *args, **kwargs):
        return types.SimpleNamespace(
            choices=[
                types.SimpleNamespace(
                    message=types.SimpleNamespace(content="Mock response")
                )
            ]
        )


# Update get_litellm to return our fake model
setattr(_ext, "get_litellm", lambda: _FakeLitellmModel())
setattr(_ext, "initialize_clients", lambda: None)  # placeholder

# Add File to google.genai.types
if _types_mod is not None:

    class File:
        def __init__(self, name="dummy-file"):
            self.name = name

    setattr(_types_mod, "File", File)


###########################################################################
# 5.  ─── Pytest fixtures users actually import in tests ------------------
###########################################################################
@pytest.fixture()
def supabase(monkeypatch: pytest.MonkeyPatch):
    """Fresh in-memory Supabase for one test – *also* replaces app.extensions.get_supabase."""
    _db = _FakeSupabase()
    monkeypatch.setattr(_ext, "get_supabase", lambda: _db, raising=True)
    return _db


@pytest.fixture()
def google_client(monkeypatch: pytest.MonkeyPatch):
    """Fake Gemini client bound to app.extensions.get_google for this test."""
    _gc = _FakeGoogleClient()
    monkeypatch.setattr(_ext, "get_google", lambda: _gc, raising=True)
    return _gc
