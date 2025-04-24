# tools/update_chat_title.py
from agents.tool import function_tool
from agents.run_context import RunContextWrapper
from app.extensions import get_supabase
from app.services.chat.models import Documents
import logging

logger = logging.getLogger(__name__)

@function_tool()
async def update_chat_title(wrapper: RunContextWrapper[Documents], title: str) -> str:
    """Update the chat title. Will return a True as boolean if it was able to sucessfully update the chat title and the string will contain the id of the updated chat title. If unsuccessful, the boolean will be false adn the string will contain the error message.

    Args:
        title: The title of the chat.
    """
    try:
        supabase_client = get_supabase()
        # get the chat id
        chat_id = wrapper.context.chat_id
        
        # update the chat title
        chat_response = supabase_client.table('chats').update({"name": title}).eq("id", chat_id).execute()
        logger.info(f"Chat Response: {chat_response}")  # Fixed logging statement
        return chat_response.data[0]['name']
    except Exception as e:
        raise e