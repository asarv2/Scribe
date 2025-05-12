# tests/test_config.py
import os
import sys
import pytest
from unittest.mock import MagicMock, patch


@pytest.fixture(autouse=True)
def use_real_config():
    """Temporarily restore the real app.config module for testing"""
    # Save the mock module if it exists
    if "app.config" in sys.modules:
        mock_config = sys.modules["app.config"]
        # Remove it from sys.modules to force a fresh import
        del sys.modules["app.config"]
    else:
        mock_config = None

    # Now import the real module
    import app.config as config

    # Run the test
    yield config

    # Restore the mock module after the test
    if mock_config is not None:
        sys.modules["app.config"] = mock_config


@pytest.fixture
def mock_torch():
    """Mock torch to avoid actual GPU operations"""
    with patch.dict(sys.modules, {"torch": MagicMock(), "whisper": MagicMock()}):
        # Configure torch mock
        sys.modules["torch"].cuda.is_available.return_value = False
        # Configure whisper mock
        whisper_mock = sys.modules["whisper"]
        whisper_mock.load_model.return_value = MagicMock()
        whisper_mock.load_model.return_value.eval.return_value = None
        whisper_mock.load_model.return_value.parameters.return_value = iter(
            [MagicMock(device=MagicMock(type="cpu"))]
        )

        yield sys.modules["torch"], sys.modules["whisper"]


def test_model_manager_initialization(use_real_config, tmp_path, monkeypatch):
    config = use_real_config

    # Redirect cache directories to tmp_path
    monkeypatch.setattr(config, "MODEL_CACHE_DIR", tmp_path / "model_cache")

    # Create a new ModelManager instance
    manager = config.ModelManager()

    # Check if directories are set correctly
    assert str(manager.cache_dir) == str(tmp_path / "model_cache")
    assert str(manager.whisper_cache_dir) == str(
        tmp_path / "model_cache" / "whisper_models"
    )

    # Check if directories were created
    assert os.path.exists(manager.cache_dir)
    assert os.path.exists(manager.whisper_cache_dir)

    # Check default model size
    assert manager.whisper_model_size == "tiny.en"


def test_get_gpu_memory(use_real_config, mock_torch):
    config = use_real_config
    torch_mock, _ = mock_torch

    manager = config.ModelManager()

    # Test when CUDA is not available
    torch_mock.cuda.is_available.return_value = False
    assert manager._get_gpu_memory() == 0

    # Test when CUDA is available
    torch_mock.cuda.is_available.return_value = True
    torch_mock.cuda.get_device_properties.return_value.total_memory = 8 * 1024**3  # 8GB
    torch_mock.cuda.memory_allocated.return_value = 2 * 1024**3  # 2GB used

    # Need to patch the torch module in the config module directly
    with patch.object(config, "torch", torch_mock):
        # Should return 6GB free
        assert manager._get_gpu_memory() == 6.0


def test_whisper_model_initialization(use_real_config, mock_torch, monkeypatch):
    config = use_real_config
    torch_mock, whisper_mock = mock_torch

    # Reset the global registry
    monkeypatch.setitem(config.MODEL_REGISTRY, "whisper_model", None)
    monkeypatch.setitem(config.MODEL_REGISTRY, "whisper_initialized", False)

    # Create a mock model that will be consistent
    mock_model = MagicMock()
    # Configure the mock model to properly handle the device check
    mock_params = MagicMock()
    mock_params.device.type = "cpu"
    mock_model.parameters.return_value = iter([mock_params])
    mock_model.to.return_value = mock_model  # Return self when .to() is called

    whisper_mock.load_model.return_value = mock_model

    # Patch the imported whisper module in the config module
    with patch.dict(sys.modules, {"whisper": whisper_mock}):
        # Also patch torch.cuda.is_available to return a consistent value
        with patch.object(torch_mock.cuda, "is_available", return_value=False):
            manager = config.ModelManager()

            # Test initializing the model
            model = manager.initialize_whisper_model()

            # Check that the model was loaded
            whisper_mock.load_model.assert_called_once_with(
                "tiny.en", download_root=manager.whisper_cache_dir
            )

            # Check that the model was stored in the registry
            assert config.MODEL_REGISTRY["whisper_model"] is model
            assert config.MODEL_REGISTRY["whisper_initialized"] is True

            # Check that get_whisper_model returns the same model
            assert manager.get_whisper_model() is model


def test_get_whisper_model_already_initialized(
    use_real_config, mock_torch, monkeypatch
):
    config = use_real_config

    # Set up a mock model in the registry
    mock_model = MagicMock()
    mock_model.parameters.return_value = iter([MagicMock(device=MagicMock(type="cpu"))])

    monkeypatch.setitem(config.MODEL_REGISTRY, "whisper_model", mock_model)
    monkeypatch.setitem(config.MODEL_REGISTRY, "whisper_initialized", True)

    manager = config.ModelManager()

    # Test getting the already initialized model
    model = manager.get_whisper_model()

    # Should return the mock model without initializing a new one
    assert model is mock_model

    # Model should be put in eval mode
    mock_model.eval.assert_called_once()
