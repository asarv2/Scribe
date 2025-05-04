from agents import Agent, RunContextWrapper
from agents import HandoffInputData
from app.services.chat.models.main import (
    Documents,
    HandoffInputSchema,
)
from typing import List
import logging

logger = logging.getLogger(__name__)


def invoke_handoff(agent: Agent[Documents]):
    async def on_invoke_handoff(
        wrapper: RunContextWrapper[Documents], args_json: str
    ) -> Agent[Documents]:
        # Parse the JSON arguments
        args = HandoffInputSchema.model_validate_json(args_json)
        reference_numbers: List[int] = args.references

        references = [
            wrapper.context.references.get(reference_number, None)
            for reference_number in reference_numbers
        ]
        document_ids = [
            ref.get("id")
            for ref in references
            if ref is not None and ref.get("file") is False
        ]
        file_ids = [
            ref.get("id")
            for ref in references
            if ref is not None and ref.get("file") is True
        ]

        # merge the references
        wrapper.context.used_files.extend(file_ids)
        wrapper.context.used_documents.extend(document_ids)

        return agent

    return on_invoke_handoff


def handoff_input_filter(data: HandoffInputData) -> HandoffInputData:
    """
    This function is used to add the files that model requests, allowing for larger context windows and the model to choose which files to use and bring into context.
    """

    # removing for now.

    # # find the references tool call in the input_history
    # initial_references = None
    # for item in data.input_history:
    #     # Check if item is a dictionary with the necessary keys
    #     if isinstance(item, dict) and item.get('call_id') == "references" and 'output' in item:
    #         initial_references = ReferencesOutputSchema.model_validate_json(item['output'])
    #         break

    # if not initial_references:
    #     logger.error("No initial references found")
    #     return data

    # # find the file ids and document ids in the arguments.
    # references: List[Reference] = []
    # for new_item in data.new_items:
    #     if isinstance(new_item, HandoffCallItem):
    #         try:
    #             args = HandoffInputSchema.model_validate_json(new_item.raw_item.arguments)
    #             reference_numbers = args.references
    #             # find the file/reference number in the initial references
    #             for reference in initial_references.references:
    #                 if reference.number in reference_numbers:
    #                     references.append(reference)
    #         except Exception as e:
    #             logger.error(f"Error parsing handoff arguments: {e}")
    #             continue

    # if not references:
    #     logger.warning("No references found")
    #     return data

    # # insert these into the conversation history
    # google_references = emit_google_references(references)

    # if google_references:
    #     new_message = {
    #         "role": "user",
    #         "content": google_references
    #     }

    #     # Create a new HandoffInputData with the updated input_history
    #     new_input_history = data.input_history + (new_message,)
    # else:
    #     new_input_history = data.input_history
    #     logger.warning("No google references found")

    # Return a new HandoffInputData object with the updated input_history
    return HandoffInputData(
        input_history=data.input_history,
        pre_handoff_items=data.pre_handoff_items,
        new_items=data.new_items,
    )
