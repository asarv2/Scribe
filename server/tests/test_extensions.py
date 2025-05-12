# tests/test_extensions.py
import os
import importlib
import pytest
import sys


@pytest.fixture(autouse=True)
def use_real_extensions():
    """Temporarily restore the real app.extensions module for testing"""
    # Save the mock module
    if "app.extensions" in sys.modules:
        mock_ext = sys.modules["app.extensions"]
        # Remove it from sys.modules to force a fresh import
        del sys.modules["app.extensions"]
    else:
        mock_ext = None

    # Now import the real module
    import app.extensions as ext

    # Run the test
    yield ext

    # Restore the mock module after the test
    if mock_ext is not None:
        sys.modules["app.extensions"] = mock_ext


def test_create_directories(tmp_path, monkeypatch, use_real_extensions):
    ext = use_real_extensions
    # Redirect all directories to tmp_path
    dirs = [
        "UPLOAD_FOLDER",
        "MODEL_CACHE_DIR",
        "FIGURES_DIR",
        "QUESTIONS_DIR",
        "SUMMARIES_DIR",
        "GRADES_DIR",
        "CHUNKS_DIR",
    ]
    for name in dirs:
        setattr(ext, name, tmp_path / name.lower())

    # Ensure none exist initially
    for name in dirs:
        path = getattr(ext, name)
        assert not path.exists()

    # Call the real create_directories function
    ext.create_directories()

    # Verify directories were created
    for name in dirs:
        path = getattr(ext, name)
        assert path.exists() and path.is_dir()


def test_initialize_clients(monkeypatch, use_real_extensions):
    ext = use_real_extensions
    # Reset clients
    ext.supabase_client = None
    ext.gemini_client = None
    ext.google_client = None
    ext.litellm_client = None

    # Mock the client classes
    class MockSupabase:
        @staticmethod
        def create_client(url, key, options=None):
            assert url == "https://example.supabase.co"
            assert key == "secret"
            assert options == {"schema": "public"}
            return "SUPABASE_CLIENT"

        @staticmethod
        def ClientOptions():
            return type(
                "MockClientOptions",
                (),
                {"replace": lambda self, schema=None: {"schema": schema}},
            )()

    class MockAsyncOpenAI:
        def __init__(self, base_url, api_key):
            self.base_url = base_url
            self.api_key = api_key

    class MockGenAI:
        def Client(self, api_key):
            return f"GOOGLE_CLIENT:{api_key}"

    class MockLitellmModel:
        def __init__(self, model, api_key):
            self.model = model
            self.api_key = api_key

    # Set up environment variables
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_PRIVATE_KEY", "secret")
    monkeypatch.setenv("SUPABASE_SCHEMA", "public")
    monkeypatch.setenv("GOOGLE_API_KEY", "google_key")

    # Mock the imports
    monkeypatch.setitem(
        sys.modules,
        "supabase.client",
        type(
            "module",
            (),
            {
                "create_client": MockSupabase.create_client,
                "ClientOptions": MockSupabase.ClientOptions,
            },
        ),
    )
    monkeypatch.setattr(ext, "AsyncOpenAI", MockAsyncOpenAI)
    monkeypatch.setattr(ext, "genai", MockGenAI())
    monkeypatch.setattr(ext, "LitellmModel", MockLitellmModel)

    # Call initialize_clients
    ext.initialize_clients()

    # Verify clients were created correctly
    assert ext.supabase_client == "SUPABASE_CLIENT"
    assert isinstance(ext.gemini_client, MockAsyncOpenAI)
    assert ext.gemini_client.api_key == "google_key"
    assert ext.google_client == "GOOGLE_CLIENT:google_key"
    assert isinstance(ext.litellm_client, MockLitellmModel)
    assert ext.litellm_client.api_key == "google_key"
    assert ext.litellm_client.model == "gemini/gemini-1.5-flash-002"


def test_missing_credentials(monkeypatch, caplog, use_real_extensions):
    ext = use_real_extensions
    # Reset clients
    ext.supabase_client = None
    ext.gemini_client = None
    ext.google_client = None
    ext.litellm_client = None

    # Remove environment variables
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_PRIVATE_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)

    # Set up logging capture
    caplog.set_level("WARNING")

    # Call initialize_clients
    ext.initialize_clients()

    # Verify no clients were created
    assert ext.supabase_client is None
    assert ext.gemini_client is None
    assert ext.google_client is None
    assert ext.litellm_client is None


def test_get_client_functions(monkeypatch, use_real_extensions):
    ext = use_real_extensions
    # Reset clients
    ext.supabase_client = None
    ext.gemini_client = None
    ext.google_client = None
    ext.litellm_client = None

    # Mock initialize_clients to set test values
    def mock_initialize():
        ext.supabase_client = "SUPABASE"
        ext.gemini_client = "GEMINI"
        ext.google_client = "GOOGLE"
        ext.litellm_client = "LITELLM"

    monkeypatch.setattr(ext, "initialize_clients", mock_initialize)

    # Test each getter
    assert ext.get_supabase() == "SUPABASE"
    assert ext.get_gemini() == "GEMINI"
    assert ext.get_google() == "GOOGLE"
    assert ext.get_litellm() == "LITELLM"


def test_paths_configuration(monkeypatch, use_real_extensions):
    ext = use_real_extensions

    # Test non-Docker environment
    monkeypatch.delenv("DOCKER_ENV", raising=False)
    importlib.reload(ext)

    expected_base = os.path.dirname(os.path.dirname(ext.__file__))
    assert ext.BASE_FOLDER == expected_base
    assert ext.UPLOAD_FOLDER == os.path.join(expected_base, "uploads")

    # Test Docker environment
    monkeypatch.setenv("DOCKER_ENV", "1")
    # Mock os.makedirs to prevent actual directory creation
    monkeypatch.setattr(os, "makedirs", lambda path, exist_ok=True: None)
    importlib.reload(ext)

    assert ext.BASE_FOLDER == "/app"
    assert ext.UPLOAD_FOLDER == "/app/uploads"
    assert ext.FIGURES_DIR == "/app/uploads/figures"
