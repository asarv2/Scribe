# tests/test_main.py
import os
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Patch environment variables and torch before importing app
with patch.dict(os.environ, {"DOCKER_ENV": ""}), \
     patch("torch.cuda.is_available", return_value=False):
    from app.main import app, init_app


@pytest.fixture
def client():
    """Create a test client for the app."""
    return TestClient(app)


def test_health_endpoint(client):
    """Test the health endpoint returns a healthy status."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_index_endpoint(client):
    """Test the index endpoint returns HTML."""
    response = client.get("/")
    assert response.status_code == 200
    assert "<h1>This is the Scribe API.</h1>" in response.text


def test_file_not_found(client):
    """Test that requesting a non-existent file returns 404."""
    response = client.get("/files/nonexistent.jpg")
    assert response.status_code == 404
    assert "File not found" in response.json()["detail"]


def test_init_app():
    """Test that init_app creates a FastAPI application with expected routes."""
    with patch("app.main.FastAPI", return_value=MagicMock()) as mock_fastapi:
        test_app = init_app()
        
        # Check that FastAPI was initialized with the correct parameters
        mock_fastapi.assert_called_once()
        
        # Check that the app includes the expected routers
        assert test_app.include_router.call_count >= 4  # At least 4 routers should be included