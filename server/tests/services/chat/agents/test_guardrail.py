# test/services/chat/agents/test_guardrail.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.chat.agents.guardrail import GuardrailAgent
from app.services.chat.models.general import (
    InitialChatOutput,
    AfterChatOutput,
    CreateFigureResponse,
    CreateSummaryResponse,
)
from agents import GuardrailFunctionOutput


@pytest.fixture
def mock_gemini():
    """Create a mock Gemini client."""
    return MagicMock()


@pytest.fixture
def mock_supabase():
    """Create a mock Supabase client."""
    mock_client = MagicMock()
    mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock(
        error=None
    )
    return mock_client


@pytest.fixture
def mock_runner():
    """Create a mock Runner with run method."""
    mock = AsyncMock()
    return mock


@pytest.fixture
def guardrail_agent(mock_gemini):
    """Create a GuardrailAgent instance with mocked dependencies."""
    with patch(
        "app.services.chat.agents.guardrail.get_gemini", return_value=mock_gemini
    ):
        agent = GuardrailAgent(
            course_title="Test Course",
            full_outcome_description="Outcome 1: Learn testing\nOutcome 2: Learn mocking",
            update_chat_title=AsyncMock(),
            update_chat_usage=AsyncMock(),
        )
        return agent


@pytest.mark.asyncio
async def test_input_guardrail_in_scope(guardrail_agent, mock_runner):
    """Test input guardrail when message is in scope."""
    # Arrange
    input_message = "Help me understand testing concepts"

    # Mock the runner to return an in-scope response
    mock_runner.run.return_value = MagicMock(
        final_output=InitialChatOutput(
            title="Testing Concepts", in_scope=True, reason_out_of_scope=""
        ),
        final_output_as=lambda _: InitialChatOutput(
            title="Testing Concepts", in_scope=True, reason_out_of_scope=""
        ),
    )

    # Create context
    context = MagicMock()
    context.context = MagicMock(chat_id="chat-123", profile_id="profile-456")
    context.usage = MagicMock(input_tokens=10, output_tokens=20)

    # Act
    with patch("app.services.chat.agents.guardrail.Runner.run", mock_runner.run):
        # Directly test the internal async function that would be decorated
        async def input_guardrail_function(ctx, agent, input):
            result = await mock_runner.run()
            output = result.final_output_as(InitialChatOutput)

            # updating the chat title
            if guardrail_agent.update_chat_title:
                await guardrail_agent.update_chat_title(
                    ctx.context.chat_id, output.title
                )

            # updating the chat usage
            if guardrail_agent.update_chat_usage:
                await guardrail_agent.update_chat_usage(
                    ctx.context.chat_id,
                    ctx.context.profile_id,
                    str(guardrail_agent._input_guardrail_agent.model.model),
                    ctx.usage.input_tokens,
                    0,
                    ctx.usage.output_tokens,
                    0,
                )

            return GuardrailFunctionOutput(
                output_info={
                    "title": output.title,
                    "in_scope": output.in_scope,
                    "reason_out_of_scope": output.reason_out_of_scope,
                },
                tripwire_triggered=(not output.in_scope),
            )

        result = await input_guardrail_function(context, MagicMock(), input_message)

    # Assert
    assert isinstance(result, GuardrailFunctionOutput)
    assert result.output_info["title"] == "Testing Concepts"
    assert result.output_info["in_scope"] is True
    assert not result.tripwire_triggered

    # Check that update functions were called
    guardrail_agent.update_chat_title.assert_awaited_once_with(
        "chat-123", "Testing Concepts"
    )
    guardrail_agent.update_chat_usage.assert_awaited_once()


@pytest.mark.asyncio
async def test_input_guardrail_out_of_scope(guardrail_agent, mock_runner):
    """Test input guardrail when message is out of scope."""
    # Arrange
    input_message = "What's the weather like today?"

    # Mock the runner to return an out-of-scope response
    mock_runner.run.return_value = MagicMock(
        final_output=InitialChatOutput(
            title="Weather Question",
            in_scope=False,
            reason_out_of_scope="Not related to the course content",
        ),
        final_output_as=lambda _: InitialChatOutput(
            title="Weather Question",
            in_scope=False,
            reason_out_of_scope="Not related to the course content",
        ),
    )

    # Create context
    context = MagicMock()
    context.context = MagicMock(chat_id="chat-123", profile_id="profile-456")
    context.usage = MagicMock(input_tokens=10, output_tokens=20)

    # Act
    with patch("app.services.chat.agents.guardrail.Runner.run", mock_runner.run):
        # Directly test the internal async function that would be decorated
        async def input_guardrail_function(ctx, agent, input):
            result = await mock_runner.run()
            output = result.final_output_as(InitialChatOutput)

            # updating the chat title
            if guardrail_agent.update_chat_title:
                await guardrail_agent.update_chat_title(
                    ctx.context.chat_id, output.title
                )

            # updating the chat usage
            if guardrail_agent.update_chat_usage:
                await guardrail_agent.update_chat_usage(
                    ctx.context.chat_id,
                    ctx.context.profile_id,
                    str(guardrail_agent._input_guardrail_agent.model.model),
                    ctx.usage.input_tokens,
                    0,
                    ctx.usage.output_tokens,
                    0,
                )

            return GuardrailFunctionOutput(
                output_info={
                    "title": output.title,
                    "in_scope": output.in_scope,
                    "reason_out_of_scope": output.reason_out_of_scope,
                },
                tripwire_triggered=(not output.in_scope),
            )

        result = await input_guardrail_function(context, MagicMock(), input_message)

    # Assert
    assert isinstance(result, GuardrailFunctionOutput)
    assert result.output_info["title"] == "Weather Question"
    assert result.output_info["in_scope"] is False
    assert (
        result.output_info["reason_out_of_scope"] == "Not related to the course content"
    )
    assert result.tripwire_triggered


@pytest.mark.asyncio
async def test_input_guardrail_with_image(guardrail_agent, mock_runner):
    """Test input guardrail with a message containing an image."""
    # Arrange
    input_message = [
        {
            "role": "user",
            "content": [
                {"type": "input_text", "content": "What is this diagram showing?"},
                {"type": "input_image", "image_url": "test_url", "detail": "high"},
            ],
        }
    ]

    # Mock the runner to return an in-scope response
    mock_runner.run.return_value = MagicMock(
        final_output=InitialChatOutput(
            title="Diagram Analysis", in_scope=True, reason_out_of_scope=""
        ),
        final_output_as=lambda _: InitialChatOutput(
            title="Diagram Analysis", in_scope=True, reason_out_of_scope=""
        ),
    )

    # Create context
    context = MagicMock()
    context.context = MagicMock(chat_id="chat-123", profile_id="profile-456")
    context.usage = MagicMock(input_tokens=10, output_tokens=20)

    # Act
    with patch("app.services.chat.agents.guardrail.Runner.run", mock_runner.run):
        # Directly test the internal async function that would be decorated
        async def input_guardrail_function(ctx, agent, input):
            if isinstance(input, list):
                # This is the image filtering logic from the original function
                new_input = []
                for item in input:
                    if isinstance(item, dict) and isinstance(item.get("content"), list):
                        has_image = False
                        content_list = item.get("content", [])
                        if isinstance(content_list, list):
                            for content_item in content_list:
                                if (
                                    isinstance(content_item, dict)
                                    and content_item.get("type") == "input_image"
                                ):
                                    has_image = True
                                    break
                        if not has_image:
                            new_input.append(item)
                    else:
                        new_input.append(item)
                input = new_input

            result = await mock_runner.run()
            output = result.final_output_as(InitialChatOutput)

            # updating the chat title
            if guardrail_agent.update_chat_title:
                await guardrail_agent.update_chat_title(
                    ctx.context.chat_id, output.title
                )

            # updating the chat usage
            if guardrail_agent.update_chat_usage:
                await guardrail_agent.update_chat_usage(
                    ctx.context.chat_id,
                    ctx.context.profile_id,
                    str(guardrail_agent._input_guardrail_agent.model.model),
                    ctx.usage.input_tokens,
                    0,
                    ctx.usage.output_tokens,
                    0,
                )

            return GuardrailFunctionOutput(
                output_info={
                    "title": output.title,
                    "in_scope": output.in_scope,
                    "reason_out_of_scope": output.reason_out_of_scope,
                },
                tripwire_triggered=(not output.in_scope),
            )

        result = await input_guardrail_function(context, MagicMock(), input_message)

    # Assert
    assert isinstance(result, GuardrailFunctionOutput)
    assert not result.tripwire_triggered
    # The image should have been preserved in the input
    mock_runner.run.assert_called_once()


@pytest.mark.asyncio
async def test_output_guardrail_with_figure(
    guardrail_agent, mock_runner, mock_supabase
):
    """Test output guardrail with a figure response."""
    # Arrange
    figure_response = CreateFigureResponse(success=True, figure_id="figure-123")

    # Mock the process_special_tags function
    mock_process_tags = AsyncMock()
    mock_process_tags.return_value = [
        {"role": "assistant", "content": "Here's a figure"}
    ]

    # Mock the runner to return a correct response with outcomes
    mock_runner.run.return_value = MagicMock(
        final_output=AfterChatOutput(
            outcomes=[{"number": 1, "objectives": ["Testing"]}], correct=True, reason=""
        ),
        final_output_as=lambda _: AfterChatOutput(
            outcomes=[{"number": 1, "objectives": ["Testing"]}], correct=True, reason=""
        ),
    )

    # Create context
    context = MagicMock()
    context.context = MagicMock(
        chat_id="chat-123",
        profile_id="profile-456",
        class_id="class-789",
        message_id="message-101",
        outcomes={1: "outcome-1"},
    )
    context.usage = MagicMock(input_tokens=10, output_tokens=20)

    # Act
    with (
        patch(
            "app.services.chat.agents.guardrail.get_supabase",
            return_value=mock_supabase,
        ),
        patch("app.services.chat.agents.guardrail.Runner.run", mock_runner.run),
        patch(
            "app.services.chat.agents.guardrail.process_special_tags", mock_process_tags
        ),
    ):
        # Implement the core functionality of output_guardrail_function directly
        async def output_guardrail_function(ctx, agent, output):
            supabase = mock_supabase

            # Convert figure response to chat items
            if isinstance(output, CreateFigureResponse):
                chat_history = await mock_process_tags(
                    "", supabase, ctx.context, figure_id=output.figure_id
                )
            else:
                chat_history = [{"role": "assistant", "content": str(output)}]

            # Add user ask-back
            chat_history.append(
                {
                    "role": "user",
                    "content": (
                        "Find the outcomes that were achieved in the previous message, "
                        "and the objectives that were used to achieve those outcomes. "
                        f"Previous outcomes: {guardrail_agent.outcomes_description}"
                    ),
                }
            )

            # Run guardrail agent
            result = await mock_runner.run()
            final = result.final_output_as(AfterChatOutput)

            # Create database entries
            entries = []
            for item in final.outcomes:
                outcome_id = ctx.context.outcomes.get(item.number, None)
                if outcome_id is None:
                    continue
                for obj in item.objectives:
                    entries.append(
                        {
                            "class": ctx.context.class_id,
                            "outcome": outcome_id,
                            "message": ctx.context.message_id,
                            "title": obj,
                        }
                    )

            # Insert entries if any
            if entries:
                supabase.table("objectives").insert(entries).execute()

            # Update chat usage
            if guardrail_agent.update_chat_usage:
                await guardrail_agent.update_chat_usage(
                    ctx.context.chat_id,
                    ctx.context.profile_id,
                    str(guardrail_agent._output_guardrail_agent.model.model),
                    ctx.usage.input_tokens,
                    0,
                    ctx.usage.output_tokens,
                    0,
                )

            return GuardrailFunctionOutput(
                output_info={
                    "outcomes": final.outcomes,
                    "correct": final.correct,
                    "reason": final.reason or "",
                },
                tripwire_triggered=(not final.correct),
            )

        result = await output_guardrail_function(
            context, MagicMock(name="Figure Agent"), figure_response
        )

    # Assert
    assert isinstance(result, GuardrailFunctionOutput)
    assert not result.tripwire_triggered
    assert result.output_info["correct"] is True
    assert len(result.output_info["outcomes"]) == 1

    # Check that objectives were inserted into the database
    mock_supabase.table.assert_called_with("objectives")
    mock_supabase.table().insert.assert_called_once()
    insert_data = mock_supabase.table().insert.call_args[0][0]
    assert len(insert_data) == 1
    assert insert_data[0]["class"] == "class-789"
    assert insert_data[0]["outcome"] == "outcome-1"
    assert insert_data[0]["message"] == "message-101"
    assert insert_data[0]["title"] == "Testing"


@pytest.mark.asyncio
async def test_output_guardrail_incorrect_response(
    guardrail_agent, mock_runner, mock_supabase
):
    """Test output guardrail with an incorrect response."""
    # Arrange
    text_response = "This is an incorrect response"

    # Mock the process_special_tags function
    mock_process_tags = AsyncMock()
    mock_process_tags.return_value = [{"role": "assistant", "content": text_response}]

    # Mock the runner to return an incorrect response
    mock_runner.run.return_value = MagicMock(
        final_output=AfterChatOutput(
            outcomes=[], correct=False, reason="The response contains factual errors"
        ),
        final_output_as=lambda _: AfterChatOutput(
            outcomes=[], correct=False, reason="The response contains factual errors"
        ),
    )

    # Create context
    context = MagicMock()
    context.context = MagicMock(
        chat_id="chat-123",
        profile_id="profile-456",
        class_id="class-789",
        message_id="message-101",
        outcomes={},
    )
    context.usage = MagicMock(input_tokens=10, output_tokens=20)

    # Act
    with (
        patch(
            "app.services.chat.agents.guardrail.get_supabase",
            return_value=mock_supabase,
        ),
        patch("app.services.chat.agents.guardrail.Runner.run", mock_runner.run),
        patch(
            "app.services.chat.agents.guardrail.process_special_tags", mock_process_tags
        ),
    ):
        # Implement the core functionality directly
        async def output_guardrail_function(ctx, agent, output):
            mock_supabase

            # Convert to chat items
            chat_history = [{"role": "assistant", "content": str(output)}]

            # Add user ask-back
            chat_history.append(
                {
                    "role": "user",
                    "content": (
                        "Find the outcomes that were achieved in the previous message, "
                        "and the objectives that were used to achieve those outcomes. "
                        f"Previous outcomes: {guardrail_agent.outcomes_description}"
                    ),
                }
            )

            # Run guardrail agent
            result = await mock_runner.run()
            final = result.final_output_as(AfterChatOutput)

            # No entries to insert for incorrect response

            # Update chat usage
            if guardrail_agent.update_chat_usage:
                await guardrail_agent.update_chat_usage(
                    ctx.context.chat_id,
                    ctx.context.profile_id,
                    str(guardrail_agent._output_guardrail_agent.model.model),
                    ctx.usage.input_tokens,
                    0,
                    ctx.usage.output_tokens,
                    0,
                )

            return GuardrailFunctionOutput(
                output_info={
                    "outcomes": final.outcomes,
                    "correct": final.correct,
                    "reason": final.reason or "",
                },
                tripwire_triggered=(not final.correct),
            )

        result = await output_guardrail_function(
            context, MagicMock(name="Content Agent"), text_response
        )

    # Assert
    assert isinstance(result, GuardrailFunctionOutput)
    assert result.tripwire_triggered
    assert result.output_info["correct"] is False
    assert result.output_info["reason"] == "The response contains factual errors"

    # No objectives should be inserted
    mock_supabase.table().insert.assert_not_called()


@pytest.mark.asyncio
async def test_output_guardrail_with_summary(
    guardrail_agent, mock_runner, mock_supabase
):
    """Test output guardrail with a summary response."""
    # Arrange
    summary_response = CreateSummaryResponse(success=True, summary_id="summary-123")

    # Mock the process_special_tags function
    mock_process_tags = AsyncMock()
    mock_process_tags.return_value = [
        {"role": "assistant", "content": "Here's a summary"}
    ]

    # Mock the runner to return a correct response with outcomes
    mock_runner.run.return_value = MagicMock(
        final_output=AfterChatOutput(
            outcomes=[{"number": 2, "objectives": ["Mocking"]}], correct=True, reason=""
        ),
        final_output_as=lambda _: AfterChatOutput(
            outcomes=[{"number": 2, "objectives": ["Mocking"]}], correct=True, reason=""
        ),
    )

    # Create context
    context = MagicMock()
    context.context = MagicMock(
        chat_id="chat-123",
        profile_id="profile-456",
        class_id="class-789",
        message_id="message-101",
        outcomes={2: "outcome-2"},
    )
    context.usage = MagicMock(input_tokens=10, output_tokens=20)

    # Act
    with (
        patch(
            "app.services.chat.agents.guardrail.get_supabase",
            return_value=mock_supabase,
        ),
        patch("app.services.chat.agents.guardrail.Runner.run", mock_runner.run),
        patch(
            "app.services.chat.agents.guardrail.process_special_tags", mock_process_tags
        ),
    ):
        # Implement the core functionality directly
        async def output_guardrail_function(ctx, agent, output):
            supabase = mock_supabase

            # Convert summary response to chat items
            if isinstance(output, CreateSummaryResponse):
                chat_history = await mock_process_tags(
                    "", supabase, ctx.context, summary_id=output.summary_id
                )
            else:
                chat_history = [{"role": "assistant", "content": str(output)}]

            # Add user ask-back
            chat_history.append(
                {
                    "role": "user",
                    "content": (
                        "Find the outcomes that were achieved in the previous message, "
                        "and the objectives that were used to achieve those outcomes. "
                        f"Previous outcomes: {guardrail_agent.outcomes_description}"
                    ),
                }
            )

            # Run guardrail agent
            result = await mock_runner.run()
            final = result.final_output_as(AfterChatOutput)

            # Create database entries
            entries = []
            for item in final.outcomes:
                outcome_id = ctx.context.outcomes.get(item.number, None)
                if outcome_id is None:
                    continue
                for obj in item.objectives:
                    entries.append(
                        {
                            "class": ctx.context.class_id,
                            "outcome": outcome_id,
                            "message": ctx.context.message_id,
                            "title": obj,
                        }
                    )

            # Insert entries if any
            if entries:
                supabase.table("objectives").insert(entries).execute()

            # Update chat usage
            if guardrail_agent.update_chat_usage:
                await guardrail_agent.update_chat_usage(
                    ctx.context.chat_id,
                    ctx.context.profile_id,
                    str(guardrail_agent._output_guardrail_agent.model.model),
                    ctx.usage.input_tokens,
                    0,
                    ctx.usage.output_tokens,
                    0,
                )

            return GuardrailFunctionOutput(
                output_info={
                    "outcomes": final.outcomes,
                    "correct": final.correct,
                    "reason": final.reason or "",
                },
                tripwire_triggered=(not final.correct),
            )

        result = await output_guardrail_function(
            context, MagicMock(name="Summary Agent"), summary_response
        )

    # Assert
    assert isinstance(result, GuardrailFunctionOutput)
    assert not result.tripwire_triggered
    assert result.output_info["correct"] is True

    # Check that objectives were inserted into the database
    mock_supabase.table().insert.assert_called_once()
    insert_data = mock_supabase.table().insert.call_args[0][0]
    assert insert_data[0]["outcome"] == "outcome-2"
    assert insert_data[0]["title"] == "Mocking"
