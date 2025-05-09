# test/services/parse/test_parse.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.parse.parse import FileParser
from app.services.parse.parse_models import SyllabusResponse


@pytest.fixture
def mock_supabase():
    """Create a mock Supabase client with the necessary methods."""
    mock_client = MagicMock()
    # Set up the execute method to return a result with no error
    mock_execute = AsyncMock()
    mock_execute.return_value = MagicMock(error=None)
    
    # Set up the chain of method calls for table().update().eq().execute()
    mock_client.table.return_value.update.return_value.eq.return_value.execute = mock_execute
    
    # Set up the chain for table().upsert().execute()
    mock_client.table.return_value.upsert.return_value.execute = mock_execute
    
    return mock_client


@pytest.fixture
def mock_gemini():
    """Create a mock Gemini client."""
    return MagicMock()


@pytest.fixture
def mock_runner():
    """Create a mock Runner with run method."""
    mock = AsyncMock()
    # Set up the run method to return a result with final_output
    mock.run.return_value = MagicMock(
        final_output=SyllabusResponse(
            class_name="Test Class",
            class_code="TEST101",
            class_description="This is a test class description.",
            outcomes=["Outcome 1", "Outcome 2"]
        )
    )
    return mock


@pytest.mark.asyncio
async def test_parse_syllabus(mock_supabase, mock_gemini, mock_runner):
    """Test that parse_syllabus correctly processes a syllabus and updates the database."""
    # Arrange
    class_id = "class-123"
    file_id = "file-456"
    google_file_id = "google-789"
    course_title = "Test Course"
    
    # Create the FileParser instance
    parser = FileParser(
        supabase_client=mock_supabase,
        class_id=class_id,
        file_id=file_id,
        course_title=course_title
    )
    
    # Act
    with patch("app.services.parse.parse.get_gemini", return_value=mock_gemini), \
         patch("app.services.parse.parse.Runner", mock_runner), \
         patch("app.services.parse.parse.Agent", return_value=MagicMock()):
        
        result = await parser.parse_syllabus(
            google_file_id=google_file_id,
            prev_class_name=None,
            prev_class_code=None,
            prev_class_description=None,
            prev_outcomes=None
        )
    
    # Assert
    # Check that the result contains the expected values
    class_name, class_code, class_description, outcomes = result
    assert class_name == "Test Class"
    assert class_code == "TEST101"
    assert class_description == "This is a test class description."
    assert outcomes == ["Outcome 1", "Outcome 2"]
    
    # Check that the database was updated correctly
    mock_supabase.table.assert_any_call("classes")
    mock_supabase.table.assert_any_call("outcomes")
    
    # Check class update
    mock_supabase.table.return_value.update.assert_called_once_with({
        "title": "Test Class",
        "class_code": "TEST101",
        "course_description": "This is a test class description."
    })
    mock_supabase.table.return_value.update.return_value.eq.assert_called_once_with("id", class_id)
    
    # Check outcomes insert
    mock_supabase.table.return_value.upsert.assert_called_once()
    # Get the argument passed to upsert
    upsert_data = mock_supabase.table.return_value.upsert.call_args[0][0]
    assert len(upsert_data) == 2
    assert upsert_data[0]["class"] == class_id
    assert upsert_data[0]["title"] == "Outcome 1"
    assert upsert_data[1]["class"] == class_id
    assert upsert_data[1]["title"] == "Outcome 2"


@pytest.mark.asyncio
async def test_parse_syllabus_with_existing_data(mock_supabase, mock_gemini, mock_runner):
    """Test that parse_syllabus respects existing data and only updates what's needed."""
    # Arrange
    class_id = "class-123"
    file_id = "file-456"
    google_file_id = "google-789"
    
    # Create the FileParser instance
    parser = FileParser(
        supabase_client=mock_supabase,
        class_id=class_id,
        file_id=file_id
    )
    
    # Act
    with patch("app.services.parse.parse.get_gemini", return_value=mock_gemini), \
         patch("app.services.parse.parse.Runner", mock_runner), \
         patch("app.services.parse.parse.Agent", return_value=MagicMock()):
        
        result = await parser.parse_syllabus(
            google_file_id=google_file_id,
            prev_class_name="Existing Class",  # Existing data
            prev_class_code="EXIST101",        # Existing data
            prev_class_description=None,       # No existing description
            prev_outcomes=["Outcome 1"]        # One existing outcome
        )
    
    # Assert
    # Check that the database was updated correctly with only the missing data
    mock_supabase.table.return_value.update.assert_called_once_with({
        "course_description": "This is a test class description."
    })
    
    # Check that only the new outcome was inserted
    upsert_data = mock_supabase.table.return_value.upsert.call_args[0][0]
    assert len(upsert_data) == 1
    assert upsert_data[0]["title"] == "Outcome 2"


@pytest.mark.asyncio
async def test_parse_syllabus_database_error(mock_supabase, mock_gemini, mock_runner):
    """Test that parse_syllabus handles database errors correctly."""
    # Arrange
    class_id = "class-123"
    file_id = "file-456"
    google_file_id = "google-789"
    
    # Set up the mock to return an error
    mock_supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = \
        MagicMock(error="Database error")
    
    # Create the FileParser instance
    parser = FileParser(
        supabase_client=mock_supabase,
        class_id=class_id,
        file_id=file_id
    )
    
    # Act & Assert
    with patch("app.services.parse.parse.get_gemini", return_value=mock_gemini), \
         patch("app.services.parse.parse.Runner", mock_runner), \
         patch("app.services.parse.parse.Agent", return_value=MagicMock()):
        
        with pytest.raises(Exception) as excinfo:
            await parser.parse_syllabus(google_file_id=google_file_id)
        
        assert "Failed to update class" in str(excinfo.value)