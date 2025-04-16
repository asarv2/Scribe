import os
from fastapi import APIRouter, Request, Body
from fastapi.responses import JSONResponse
from app.extensions import supabase
import google.generativeai as genai
from dotenv import load_dotenv
import logging
import json

load_dotenv()
router = APIRouter()
logger = logging.getLogger(__name__)

# Configure Gemini API
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GOOGLE_API_KEY)

@router.post("/analyze-connections")
async def analyze_connections(
    request: Request,
    payload: dict = Body(...)
):
    """
    Analyze outcomes, objectives, and tasks and suggest connections based on conceptual meaning.
    
    The algorithm works in two phases:
    1. Connect objectives to outcomes (each objective connects to one outcome)
    2. Connect tasks to objectives (each task connects to one objective)
    
    Returns suggested connections that can be applied in the client.
    """
    try:
        class_id = payload.get("class_id")
        outcomes = payload.get("outcomes", [])
        objectives = payload.get("objectives", [])
        tasks = payload.get("tasks", [])
        
        logger.info(f"Analyzing connections for class {class_id}")
        logger.info(f"Received {len(outcomes)} outcomes, {len(objectives)} objectives, {len(tasks)} tasks")
        
        # Validate the data
        if not class_id:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing required parameter: class_id"}
            )
            
        # Validate outcomes have required fields before processing
        valid_outcomes = [
            outcome for outcome in outcomes 
            if isinstance(outcome, dict) and 
            outcome.get("id") and 
            outcome.get("title")
        ]
        
        if not valid_outcomes:
            return JSONResponse(
                status_code=400,
                content={"error": "No valid outcomes provided - must have id and title properties"}
            )
            
        # Validate objectives have required fields before processing
        valid_objectives = [
            objective for objective in objectives 
            if isinstance(objective, dict) and 
            objective.get("id") and 
            objective.get("title")
        ]
        
        # Validate tasks have required fields before processing
        valid_tasks = [
            task for task in tasks 
            if isinstance(task, dict) and 
            task.get("id") and 
            (task.get("title") or task.get("name"))  # Tasks might use "name" instead of "title"
        ]
        
        # Normalize task data - ensure each task has a title property
        normalized_tasks = []
        for task in valid_tasks:
            normalized_task = task.copy()
            if not normalized_task.get("title") and normalized_task.get("name"):
                normalized_task["title"] = normalized_task["name"]
            normalized_tasks.append(normalized_task)
        
        logger.info(f"After validation: {len(valid_outcomes)} valid outcomes, {len(valid_objectives)} valid objectives, {len(normalized_tasks)} valid tasks")
            
        # Phase 1: Analyze objectives and connect to outcomes
        objective_connections = []
        if valid_outcomes and valid_objectives:
            objective_connections = await analyze_objective_connections(valid_outcomes, valid_objectives)
            
        # Phase 2: Analyze tasks and connect to objectives
        task_connections = []
        if valid_objectives and normalized_tasks:
            task_connections = await analyze_task_connections(valid_objectives, normalized_tasks)
            
        logger.info(f"Generated {len(objective_connections)} objective connections and {len(task_connections)} task connections")
            
        return {
            "success": True,
            "objective_connections": objective_connections,
            "task_connections": task_connections
        }
        
    except Exception as e:
        logger.error(f"Error analyzing connections: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to analyze connections: {str(e)}"}
        )

async def analyze_objective_connections(outcomes, objectives):
    """
    Use Gemini to analyze which outcome each objective should connect to.
    """
    # No connections needed if either list is empty
    if not outcomes or not objectives:
        return []
        
    try:
        # Format the data for Gemini prompt - with error handling
        outcomes_text = "\n".join([
            f"Outcome {i+1}: {outcome.get('title', 'Untitled')} - {outcome.get('description', 'No description')}" 
            for i, outcome in enumerate(outcomes)
        ])
        
        objectives_text = "\n".join([
            f"Objective {i+1}: {objective.get('title', 'Untitled')} - {objective.get('description', 'No description')}" 
            for i, objective in enumerate(objectives)
        ])
        
        # Create prompt for Gemini - Fixed the JSON example formatting
        prompt = f"""
        You are an expert in educational curriculum design. I have a set of learning outcomes and objectives. 
        Your task is to determine which outcome each objective should connect to based on conceptual meaning rather than just word similarity.
        
        Each objective should connect to exactly one outcome. An outcome can connect to multiple objectives.
        
        Here are the outcomes:
        {outcomes_text}
        
        Here are the objectives:
        {objectives_text}
        
        For each objective, identify the single most appropriate outcome it should connect to.
        Analyze the conceptual meaning, not just word similarity.
        
        Output your answer as a JSON array where each item contains:
        1. "objective_id": The ID of the objective
        2. "outcome_id": The ID of the outcome it should connect to
        3. "confidence": A number between 0 and 1 indicating your confidence
        4. "explanation": A brief explanation of why this connection makes sense
        
        Response format example:
        [
          {{
            "objective_id": "{objectives[0].get('id', 'objective_example_id')}",
            "outcome_id": "{outcomes[0].get('id', 'outcome_example_id')}",
            "confidence": 0.9,
            "explanation": "This objective clearly supports the outcome because..."
          }}
        ]
        """
        
        # Call Gemini API
        model = genai.GenerativeModel('gemini-1.5-pro')
        response = model.generate_content(prompt)
        
        # Extract JSON from response
        # Look for JSON in the response - it might be in a code block or directly in text
        response_text = response.text
        if "```json" in response_text:
            json_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            json_text = response_text.split("```")[1].split("```")[0].strip()
        else:
            json_text = response_text
            
        connections = json.loads(json_text)
        
        # Add source and target IDs for client-side processing
        for conn in connections:
            conn["source_id"] = conn["outcome_id"]
            conn["target_id"] = conn["objective_id"]
            conn["source_type"] = "outcome"
            conn["target_type"] = "objective"
            
        return connections
        
    except Exception as e:
        logger.error(f"Error analyzing objective connections: {str(e)}")
        logger.error(f"Raw response: {getattr(response, 'text', 'No response')}")
        import traceback
        logger.error(traceback.format_exc())
        return []
    
async def analyze_task_connections(objectives, tasks):
    """
    Use Gemini to analyze which objective each task should connect to.
    """
    # No connections needed if either list is empty
    if not objectives or not tasks:
        return []
        
    try:
        # Format the data for Gemini prompt - with error handling
        objectives_text = "\n".join([
            f"Objective {i+1}: {objective.get('title', 'Untitled')} - {objective.get('description', 'No description')}" 
            for i, objective in enumerate(objectives)
        ])
        
        tasks_text = "\n".join([
            f"Task {i+1}: {task.get('title', 'Untitled')} - {task.get('description', 'No description')}" 
            for i, task in enumerate(tasks)
        ])
        
        # Create prompt for Gemini - Fixed the JSON example formatting
        prompt = f"""
        You are an expert in educational curriculum design. I have a set of learning objectives and tasks/lectures. 
        Your task is to determine which objective each task should connect to based on conceptual meaning rather than just word similarity.
        
        Each task should connect to exactly one objective. An objective can connect to multiple tasks.
        
        Here are the objectives:
        {objectives_text}
        
        Here are the tasks:
        {tasks_text}
        
        For each task, identify the single most appropriate objective it should connect to.
        Analyze the conceptual meaning, not just word similarity.
        
        Output your answer as a JSON array where each item contains:
        1. "task_id": The ID of the task
        2. "objective_id": The ID of the objective it should connect to
        3. "confidence": A number between 0 and 1 indicating your confidence
        4. "explanation": A brief explanation of why this connection makes sense
        
        Response format example:
        [
          {{
            "task_id": "{tasks[0].get('id', 'task_example_id')}",
            "objective_id": "{objectives[0].get('id', 'objective_example_id')}",
            "confidence": 0.85,
            "explanation": "This task clearly supports the objective because..."
          }}
        ]
        """
        
        # Call Gemini API
        model = genai.GenerativeModel('gemini-1.5-pro')
        response = model.generate_content(prompt)
        
        # Extract JSON from response
        # Look for JSON in the response - it might be in a code block or directly in text
        response_text = response.text
        if "```json" in response_text:
            json_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            json_text = response_text.split("```")[1].split("```")[0].strip()
        else:
            json_text = response_text
            
        connections = json.loads(json_text)
        
        # Add source and target IDs for client-side processing
        for conn in connections:
            conn["source_id"] = conn["objective_id"]
            conn["target_id"] = conn["task_id"]
            conn["source_type"] = "objective"
            conn["target_type"] = "task"
            
        return connections
        
    except Exception as e:
        logger.error(f"Error analyzing task connections: {str(e)}")
        logger.error(f"Raw response: {getattr(response, 'text', 'No response')}")
        import traceback
        logger.error(traceback.format_exc())
        return []

@router.post("/apply-connections")
async def batch_create_connections(
    request: Request,
    payload: dict = Body(...)
):
    """
    Apply connections in batch to the database.
    """
    try:
        class_id = payload.get("class_id")
        connections = payload.get("connections", [])
        
        logger.info(f"Received request to apply {len(connections)} connections for class {class_id}")
        
        if not class_id or not connections:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing required parameters: class_id and connections"}
            )
        
        # Apply connections in batch
        updated_count = 0
        for conn in connections:
            if conn.get("source_type") == "outcome" and conn.get("target_type") == "objective":
                # Update objective to connect to outcome
                outcome_id = conn.get("source_id")
                objective_id = conn.get("target_id")
                
                logger.info(f"Connecting objective {objective_id} to outcome {outcome_id}")
                
                try:
                    # First try updating with handle information
                    if "source_handle" in conn and "target_handle" in conn:
                        source_handle = conn.get("source_handle")
                        target_handle = conn.get("target_handle")
                        
                        logger.info(f"Using handles: source={source_handle}, target={target_handle}")
                        
                        # Check if the columns exist in the table
                        try:
                            # Simple query to check if the columns exist
                            check_result = supabase.table("objectives").select("connection_source_handle").limit(1).execute()
                            has_handle_columns = True
                        except Exception as e:
                            logger.warning(f"Handle columns check failed: {str(e)}")
                            has_handle_columns = False
                        
                        if has_handle_columns:
                            # Update with handle information
                            result = supabase.table("objectives").update({
                                "outcome_id": outcome_id,
                                "connection_source_handle": source_handle,
                                "connection_target_handle": target_handle
                            }).eq("id", objective_id).execute()
                        else:
                            # Update without handle information
                            result = supabase.table("objectives").update({
                                "outcome_id": outcome_id
                            }).eq("id", objective_id).execute()
                    else:
                        # No handle info provided, just update relationship
                        result = supabase.table("objectives").update({
                            "outcome_id": outcome_id
                        }).eq("id", objective_id).execute()
                    
                    # Count successful updates    
                    if result.data:
                        updated_count += 1
                        logger.info(f"Successfully updated objective {objective_id}")
                    else:
                        logger.warning(f"No data returned when updating objective {objective_id}")
                
                except Exception as update_error:
                    # If error occurs with the full update (likely schema issue)
                    logger.warning(f"Error during full update: {str(update_error)}")
                    logger.warning("Falling back to basic connection update")
                    
                    # Fall back to just updating the outcome_id
                    try:
                        basic_result = supabase.table("objectives").update({
                            "outcome_id": outcome_id
                        }).eq("id", objective_id).execute()
                        
                        if basic_result.data:
                            updated_count += 1
                            logger.info(f"Fallback update successful for objective {objective_id}")
                        else:
                            logger.warning(f"Fallback update failed for objective {objective_id}")
                    except Exception as fallback_error:
                        logger.error(f"Even fallback update failed: {str(fallback_error)}")
                    
            # Could add support for task connections here if needed
                
        logger.info(f"Updated {updated_count} connections successfully")
        return {
            "success": True,
            "updated_count": updated_count
        }
        
    except Exception as e:
        logger.error(f"Error applying connections: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to apply connections: {str(e)}"}
        )
