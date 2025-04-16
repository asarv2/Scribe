# creating the tools
from typing import List, Tuple, Union
from agents import function_tool, RunContextWrapper
from app.services.chat.models import MultipleChoiceQuestion, FreeResponseQuestion, Documents
from app.extensions import supabase

@function_tool  
async def create_figure(wrapper: RunContextWrapper[Documents], python_code: str, references: List[int]) -> str:
    """Generates a figure object given the python code that will produce the figure. This will return the id of the figure, which will then be replaced by the actual figure of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the figure id itself, as this is unknown to the user.

    Args:
        python_code: The python code that will produce the figure.
        references: List of number references that were used.
    """
    # 1. Execute the python code
    import io
    import matplotlib.pyplot as plt
    import scipy
    import networkx as nx
    import numpy as np
    import seaborn as sns
    
    try:
        # get class id
        class_id = wrapper.context.class_id
        # get the message id
        message_id = wrapper.context.message_id

        # get references
        references = [wrapper.context.references.get(ref, None) for ref in references]
        references = [ref for ref in references if ref is not None]

        # find the first figure that is generating
        figure_response = supabase.table('figures').select('id').eq('generation_status', 'generating').eq('message', message_id).order('created_at', desc=True).execute()
        figure_id = figure_response.data[0]['id']

        # Clear any existing plots
        plt.close('all')
        
        # Create namespace with pre-imported modules and ensure plt.figure is called
        namespace = {
            'plt': plt,
            'np': np,
            'scipy': scipy,
            'nx': nx,
            'sns': sns,
            'figure': plt.figure(),
        }
        
        # Set non-interactive backend before executing code
        plt.switch_backend('Agg')
        
        # Execute the code
        exec(python_code, namespace)
        
        # Get the current figure
        current_fig = plt.gcf()
        
        # Verify the figure has actual content
        if len(current_fig.axes) == 0 or not any(ax.lines or ax.collections or ax.patches or ax.images for ax in current_fig.axes):
            return False, "Figure was created but has no plotted content"
        
        # 2. Save the figure to supabase, first in database, then storage
        # Save to buffer for Supabase
        buffer = io.BytesIO()
        current_fig.savefig(buffer, format='png', bbox_inches='tight', dpi=300)
        buffer.seek(0)
        
        # Upload to Supabase storage
        supabase.storage.from_('figures').upload(
            f"{class_id}/{figure_id}.png",
            buffer.getvalue(),
            {'content-type': 'image/png'}
        )
        
        # Clean up
        plt.close('all')

        # Update the figure into the database
        figure_update_response = supabase.table('figures').update({
            "message": message_id,
            "code": python_code,
            "references": references,
            "generation_status": "complete"
        }).eq("id", figure_id).execute()

        if not (figure_update_response.data and len(figure_update_response.data) > 0):
            raise Exception("Failed to update figure: No ID returned from database")
        
        return figure_id
        
    except Exception as e:
        plt.close('all')  # Ensure cleanup even on error
        raise e

@function_tool
async def create_summary(wrapper: RunContextWrapper[Documents], preamble: str, body: str, conclusion: str, references: List[int]) -> str:
    """Generates a summary object given the preamble, body, and conclusion. This will return the id of the summary, which will then be replaced by the actual summary of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the summary id itself, as this is unknown to the user.

    Args:
        preamble: The preamble of the summary.
        body: The body of the summary.
        conclusion: The conclusion of the summary.
    """
    try:
        # get the message id
        message_id = wrapper.context.message_id
        
        # Get references
        references = [wrapper.context.references[ref] for ref in references]

        # find the first summary that is generating
        summary_response = supabase.table('summaries').select('id').eq('generation_status', 'generating').eq('message', message_id).order('created_at', desc=True).execute()
        summary_id = summary_response.data[0]['id']
        print("Summary ID: ", summary_id)
        
        # Update the summary into the database
        summary_update_response = supabase.table('summaries').update({
            "preamble": preamble,
            "body": body,
            "conclusion": conclusion,
            "references": references,
            "generation_status": "complete"
        }).eq("id", summary_id).execute()
        
        # Extract the summary ID from the response
        if not (summary_update_response.data and len(summary_update_response.data) > 0):
            raise Exception("Failed to update summary: No ID returned from database")
        
        return summary_id
            
    except Exception as e:
        raise e

@function_tool
async def create_question(wrapper: RunContextWrapper[Documents], question: Union[MultipleChoiceQuestion, FreeResponseQuestion], references: List[int]) -> str:
    """Generates a question object given the MCQ or FRQ question. This will return the id of the question, which will then be replaced by the actual question of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the question id itself, as this is unknown to the user.

    Args:
        question: The question object, either MultipleChoiceQuestion or FreeResponseQuestion.
    """
    try:

        # get the message id
        message_id = wrapper.context.message_id
        
        # Get references
        references = [wrapper.context.references[ref] for ref in references]

        # find the first question that is generating
        question_response = supabase.table('questions').select('id').eq('generation_status', 'generating').eq('message', message_id).order('created_at', desc=True).execute()
        question_id = question_response.data[0]['id']
        
        # Determine question type and prepare data
        if isinstance(question, MultipleChoiceQuestion):
            question_data = {
                "problem": question.question,
                "options": question.options,
                "explanations": question.explanations,
                "answers": [question.answer],
                "frq": False,
                "references": references,
                "generation_status": "complete"
            }
        elif isinstance(question, FreeResponseQuestion):
            question_data = {
                "problem": question.question,
                "solution": question.answer,
                "frq": True,
                "references": references,
                "generation_status": "complete"
            }
        
        # Insert the question into the database
        question_update_response = supabase.table('questions').update(question_data).eq("id", question_id).execute()

        if not (question_update_response.data and len(question_update_response.data) > 0):
            raise Exception("Failed to update question: No ID returned from database")
        
        return question_id
            
    except Exception as e:
        raise e

@function_tool
async def update_chat_title(wrapper: RunContextWrapper[Documents], title: str) -> str:
    """Update the chat title. Will return a True as boolean if it was able to sucessfully update the chat title and the string will contain the id of the updated chat title. If uncesseccful, the boolean will be false adn the string will contain the error message.

    Args:
        title: The title of the chat.
    """
    try:
        # get the chat id
        chat_id = wrapper.context.chat_id
        
        # update the chat title
        chat_response = supabase.table('chats').update({"name": title}).eq("id", chat_id).execute()
        print("Chat Response: ", chat_response)
        return chat_response.data[0]['name']
    except Exception as e:
        raise e