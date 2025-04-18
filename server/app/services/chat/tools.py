# creating the tools
from typing import List, Tuple, Union
from agents import function_tool, RunContextWrapper
from app.services.chat.models import MultipleChoiceQuestion, FreeResponseQuestion, Documents, clean_references
from app.extensions import supabase

@function_tool  
async def create_figure(wrapper: RunContextWrapper[Documents], title: str, python_code: str, references: List[int]) -> int:
    """Generates a figure object given the python code that will produce the figure. Make sure not to add the title to the plot, as this will be added seperately. This will return the number of the figure, which will then be replaced by the actual figure of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the figure number itself, as this is unknown to the user.

    The following imports are available:
    - import io
    - import matplotlib.pyplot as plt
    - import scipy
    - import networkx as nx (also available as 'x')
    - import numpy as np
    - import seaborn as sns
    - import pandas as pd
    - import matplotlib.colors as mcolors

    Args:
        title: The title of the figure.
        python_code: The python code that will produce the figure. Do not add the title to the plot, as this will be added seperately.
        references: List of number references that were used.

    Returns:
        The number of the figure.
    """
    # 1. Execute the python code
    import io
    import matplotlib.pyplot as plt
    import scipy
    import networkx as nx
    import numpy as np
    import seaborn as sns
    import pandas as pd
    import matplotlib.colors as mcolors
    
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

        # get the figure number, by checking which position in the wrapper.context.figures list it is
        figure_number = wrapper.context.figures.index(figure_id) + 1

        # Clear any existing plots
        plt.close('all')
        
        # Create namespace with pre-imported modules and ensure plt.figure is called
        namespace = {
            'plt': plt,
            'np': np,
            'scipy': scipy,
            'nx': nx,
            'x': nx,  # Add networkx with alternative alias
            'sns': sns,
            'pd': pd,
            'mcolors': mcolors,
            'figure': plt.figure(figsize=(10, 6)),  # Default to a larger figure size
        }
        
        # Set non-interactive backend before executing code
        plt.switch_backend('Agg')
        
        # Execute the code
        exec(python_code, namespace)
        
        # Get the current figure
        current_fig = plt.gcf()
        
        # Apply some styling improvements
        plt.tight_layout()
        
        # Verify the figure has actual content
        if len(current_fig.axes) == 0 or not any(ax.lines or ax.collections or ax.patches or ax.images or ax.texts for ax in current_fig.axes):
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
            "title": title,
            "code": python_code,
            "references": references,
            "generation_status": "complete"
        }).eq("id", figure_id).execute()

        if not (figure_update_response.data and len(figure_update_response.data) > 0):
            raise Exception("Failed to update figure: No ID returned from database")
        
        return figure_number
        
    except Exception as e:
        plt.close('all')  # Ensure cleanup even on error

        # update the figure into the database
        figure_update_response = supabase.table('figures').update({
            "generation_status": "error",
            "generation_error": str(e)
        }).eq("id", figure_id).execute()

        raise e

@function_tool
async def create_summary(wrapper: RunContextWrapper[Documents], title: str, preamble: str, body: str, conclusion: str, references: List[int] = [], figures: List[int] = []) -> str:
    """Generates a summary object given the preamble, body, and conclusion. If you need any figures generated via matplotlib beforehand, use the create_figure tool. This will return the number of the figure, which you can pass to this tool.

    To include document references in the summary, you should use [x], where x is the reference number. This helps to leave the user with a reference to the document that they can click on to view the document.

    You should aim to output in inline LaTeX, as this will be easier for the user to read. Moreover, you can use markdown bullet points to make the summary more readable.

    This function will return the id of the summary, which will then be replaced by the actual summary of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the summary id itself, as this is unknown to the user. 

    Args:
        title: The title of the summary.
        preamble: The preamble of the summary.
        body: The body of the summary.
        conclusion: The conclusion of the summary.
        references: List of number references that were used.
        figures: List of figure numbers that were generated beforehand, that should be included for the given summary.

    Example Summary:
    Title: Simplex Method Summary
    Preamble: This summary explores the simplex method and its variants for solving linear programming problems, emphasizing both the algorithmic process and the underlying mathematical structure.
    Body:
        - The simplex method iteratively moves from one vertex of the feasible region to another, improving the objective function value at each step until the optimal solution is found.\n"
        - **Basic Variables/Basic Feasible Solution**: Basic variables define a vertex of the feasible region; setting non-basic variables to zero yields a basic feasible solution.\n"
        - **Slack Variable**: Slack variables convert inequality constraints into equality constraints, enabling the use of matrix methods.\n"
        - **Feasible Region**: The feasible region is the set of all points satisfying all constraints of the linear program; it is typically a convex polytope.\n"
        - **Optimal Dictionary**: The optimal dictionary expresses basic variables in terms of non-basic variables and provides the optimal objective function value.\n"
        - **Reduced Costs**: Reduced costs represent the change in the objective function value per unit increase in a non-basic variable; non-negativity is necessary and sufficient for optimality.\n"
        - **Visualization**: See Figure 1 for a geometric illustration of the simplex method traversing the vertices of a feasible region.\n"
    Conclusion: The simplex method and its variants, including the network simplex method, provide efficient algorithms for solving large-scale linear programs by leveraging the structure of the feasible region and the properties of basic feasible solutions.\n"
    Figures: [create_figure: A 2D plot showing the feasible region of a linear program as a polygon, with arrows indicating the path taken by the simplex method from vertex to vertex toward the optimal solution.]\n"

    Returns:
        The id of the summary.

    Remember, do not repeat the summary in a message after this tool is run, as this will be confusing to the user.
    """
    try:
        import re
        
        # get the message id
        message_id = wrapper.context.message_id
        
        # Get references
        references = [wrapper.context.references.get(ref, None) for ref in references]
        references = [ref for ref in references if ref is not None]

        # find the first summary that is generating
        summary_response = supabase.table('summaries').select('id').eq('generation_status', 'generating').eq('message', message_id).order('created_at', desc=True).execute()
        summary_id = summary_response.data[0]['id']

        # convert figure numbers to ids
        figure_ids = [wrapper.context.figures[figure_number - 1] for figure_number in figures]
        
        # Apply replacements to all text sections
        preamble = clean_references(preamble, wrapper.context.references)
        body = clean_references(body, wrapper.context.references)
        conclusion = clean_references(conclusion, wrapper.context.references)
        
        # Update the summary into the database
        summary_update_response = supabase.table('summaries').update({
            "title": title,
            "preamble": preamble,
            "body": body,
            "conclusion": conclusion,
            "references": references,
            "figures": figure_ids,
            "generation_status": "complete"
        }).eq("id", summary_id).execute()
        
        # Extract the summary ID from the response
        if not (summary_update_response.data and len(summary_update_response.data) > 0):
            raise Exception("Failed to update summary: No ID returned from database")
        
        return summary_id
            
    except Exception as e:
        # update the summary into the database
        summary_update_response = supabase.table('summaries').update({
            "generation_status": "error",
            "generation_error": str(e)
        }).eq("id", summary_id).execute()

        raise e

@function_tool
async def create_mcq_question(wrapper: RunContextWrapper[Documents], title: str = "", question: str = "", options: List[str] = [], explanations: List[str] = [], answer: str = "", references: List[int] = [], figures: List[int] = []) -> str:
    """Generates a question object given the MCQ question. If you need any figures generated via matplotlib beforehand, use the create_figure tool. This will return the number of the figure, which you can pass to this tool. 
    
    This function will return the id of the question, which will then be replaced by the actual question of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the question id itself, as this is unknown to the user.

    Remember, do not repeat the question in a message after this tool is run, as this will be confusing to the user.

    Args:
        title: The title of the question.
        question: The question.
        options: List of options for the question.
        explanations: List of explanations for the options.
        answer: The answer to the question.
        references: List of number references that were used.
        figures: List of figure numbers that were generated beforehand, that should be included for the given question.

    Returns:
        The id of the question.
    """
    try:

        # get the message id
        message_id = wrapper.context.message_id
        
        # Get references
        references = [wrapper.context.references.get(ref, None) for ref in references]
        references = [ref for ref in references if ref is not None]

        # find the first question that is generating
        question_response = supabase.table('questions').select('id').eq('generation_status', 'generating').eq('message', message_id).order('created_at', desc=True).execute()
        question_id = question_response.data[0]['id']

        # convert figure numbers to ids
        figure_ids = [wrapper.context.figures[figure_number - 1] for figure_number in figures]
        
        question_data = {
            "title": title,
            "problem": question,
            "options": options,
            "explanations": explanations,
            "answers": [answer],
            "frq": False,
            "figures": figure_ids,
            "references": references,
            "generation_status": "complete"
        }
        
        # Insert the question into the database
        question_update_response = supabase.table('questions').update(question_data).eq("id", question_id).execute()

        if not (question_update_response.data and len(question_update_response.data) > 0):
            raise Exception("Failed to update question: No ID returned from database")
        
        return question_id
            
    except Exception as e:

        # update the question into the database
        question_update_response = supabase.table('questions').update({
            "generation_status": "error",
            "generation_error": str(e)
        }).eq("id", question_id).execute()   

        raise e

@function_tool
async def create_frq_question(wrapper: RunContextWrapper[Documents], title: str = "", question: str = "", answer: str = "", references: List[int] = [], figures: List[int] = []) -> str:
    """Generates a question object given the FRQ question. If you need any figures generated via matplotlib beforehand, use the create_figure tool. This will return the number of the figure, which you can pass to this tool. 
    
    This function will return the id of the question, which will then be replaced by the actual question of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the question id itself, as this is unknown to the user.

    Args:
        title: The title of the question.
        question: The question.
        answer: The answer to the question.
        references: List of number references that were used.
        figures: List of figure numbers that were generated beforehand, that should be included for the given question.

    Returns:
        The id of the question.
    """
    try:

        # get the message id
        message_id = wrapper.context.message_id
        
        # Get references
        references = [wrapper.context.references.get(ref, None) for ref in references]
        references = [ref for ref in references if ref is not None]

        # find the first question that is generating
        question_response = supabase.table('questions').select('id').eq('generation_status', 'generating').eq('message', message_id).order('created_at', desc=True).execute()
        question_id = question_response.data[0]['id']

        # convert figure numbers to ids
        figure_ids = [wrapper.context.figures[figure_number - 1] for figure_number in figures]

        question_data = {
                "title": title,
                "problem": question,
                "solution": answer,
                "frq": True,
                "figures": figure_ids,
                "references": references,
                "generation_status": "complete"
        }
        
        # Insert the question into the database
        question_update_response = supabase.table('questions').update(question_data).eq("id", question_id).execute()

        if not (question_update_response.data and len(question_update_response.data) > 0):
            raise Exception("Failed to update question: No ID returned from database")
        
        return question_id
            
    except Exception as e:

        # update the question into the database
        question_update_response = supabase.table('questions').update({
            "generation_status": "error",
            "generation_error": str(e)
        }).eq("id", question_id).execute()   

        raise e

@function_tool
async def update_chat_title(wrapper: RunContextWrapper[Documents], title: str) -> str:
    """Update the chat title. Will return a True as boolean if it was able to sucessfully update the chat title and the string will contain the id of the updated chat title. If unsuccessful, the boolean will be false adn the string will contain the error message.

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