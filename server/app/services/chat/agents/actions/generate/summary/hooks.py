from agents import AgentHooks, RunContextWrapper, Agent
from typing import List
from agents.tool import function_tool, FunctionTool
from agents.run_context import RunContextWrapper
from typing import List, Optional, Tuple
from app.extensions import get_supabase
from app.services.chat.models.main import Documents, Summary, CreateSummaryResponse, CreateFigureResponse
from app.services.chat.agents.actions.generate.figure.hooks import FigureHooks
from app.services.chat.utils.references import clean_references
import logging

logger = logging.getLogger(__name__)

class SummaryHooks(AgentHooks):

    def __init__(self):
        # import the figure hooks
        self.figure_hooks = FigureHooks()
        self.supabase_client = get_supabase()

    async def on_handoff(
        self,
        wrapper: RunContextWrapper[Documents],
        agent: Agent[Documents],
        source: Agent[Documents],
    ) -> None:
        """Called when the agent is being handed off to. The `source` is the agent that is handing
        off to this agent."""
        message_id = wrapper.context.message_id
        # update the status text
        self.supabase_client.table("messages").update({
            "status_text": f"Getting ready to create summaries..."
        }).eq("id", message_id).execute()

    async def on_end(
        self,
        wrapper: RunContextWrapper[Documents],
        agent: Agent[Documents],
        summaries: List[Summary],
    ) -> List[CreateSummaryResponse]:
        """Generates the summaries in supabase and returns the responses to the user."""

        # get the message id
        message_id = wrapper.context.message_id

        responses = []
        for summary in summaries:
            summary_id: str | None = None
            try:
                title = summary.title
                preamble = summary.preamble
                body = summary.body
                conclusion = summary.conclusion
                figures = summary.figures

                # Get references
                references = [wrapper.context.references.get(ref, None) for ref in summary.references]
                references = [ref for ref in references if ref is not None]

                # Apply replacements to all text sections
                preamble = clean_references(preamble, wrapper.context.references)
                body = clean_references(body, wrapper.context.references)
                conclusion = clean_references(conclusion, wrapper.context.references)

                # insert a summary in the database, with the generation status set to generating
                summary_response = self.supabase_client.table('summaries').insert({
                    'generation_status': 'generating',
                    'message': message_id,
                    'title': title,
                    'preamble': preamble,
                    'body': body,
                    'conclusion': conclusion,
                    'references': references
                }).execute()
                summary_id = summary_response.data[0]['id']

                # create any figures that are needed
                figure_responses = await self.figure_hooks.on_end(wrapper, agent, figures)

                figure_errors = []
                figure_ids = []
                for figure_response in figure_responses:
                    if isinstance(figure_response, CreateFigureResponse):
                        if not figure_response.success:
                            figure_errors.append(figure_response.error)
                        else:
                            figure_errors.append(None)
                            figure_ids.append(figure_response.figure_id)

                if figure_errors:
                    raise Exception("Failed to create figures with the following errors: " + ", ".join(figure_errors))
                else:
                    summary_update_data = {
                        "figures": figure_ids,
                        "generation_status": "complete"
                    }

                    if summary_id is None:
                        raise Exception("Failed to create summary: No ID returned from database")

                    # Insert the question into the database
                    summary_update_response = self.supabase_client.table('summaries').update(summary_update_data).eq("id", summary_id).execute()

                    if not (summary_update_response.data and len(summary_update_response.data) > 0):
                        raise Exception("Failed to update summary: No ID returned from database")
                    
                    responses.append(CreateSummaryResponse(success=True, summary_id=summary_id))
            
            except Exception as e:
                if summary_id is not None:
                    # update the summary into the database
                    summary_update_response = self.supabase_client.table('summaries').update({
                        "generation_status": "error",
                        "generation_error": str(e)
                    }).eq("id", summary_id).execute()

                responses.append(CreateSummaryResponse(success=False, error=str(e)))

        return responses