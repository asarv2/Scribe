import { Lecture, Objective, Outcome, TypedSupabaseClient } from "../../types";

// Interface for a connection suggestion
export interface ConnectionSuggestion {
  source_id: string;
  target_id: string;
  source_type: string;
  target_type: string;
  confidence: number;
  explanation: string;
  // Optional handle information
  source_handle?: string;
  target_handle?: string;
}

// Interface for the analysis response
interface AnalysisResponse {
  success: boolean;
  objective_connections: ConnectionSuggestion[];
  task_connections: ConnectionSuggestion[];
  error?: string;
}

// Interface for applying connections
interface ApplyConnectionsResponse {
  success: boolean;
  updated_count: number;
  error?: string;
}

/**
 * Analyze connections between outcomes, objectives, and tasks
 * using AI to determine conceptual relationships
 */
export async function analyzeConnections(
  classId: string,
  outcomes: Outcome[],
  objectives: Objective[],
  tasks: Lecture[]
): Promise<AnalysisResponse> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      console.error("API URL not configured");
      return {
        success: false,
        objective_connections: [],
        task_connections: [],
        error: "API URL not configured"
      };
    }

    console.log(`Sending connection analysis request to ${apiUrl}/learning/analyze-connections`);
    console.log(`Data: ${outcomes.length} outcomes, ${objectives.length} objectives, ${tasks.length} tasks`);
    
    const response = await fetch(`${apiUrl}/learning/analyze-connections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        class_id: classId,
        outcomes,
        objectives,
        tasks
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API responded with status ${response.status}:`, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Analysis response:", {
      success: data.success,
      objective_connections: data.objective_connections?.length || 0,
      task_connections: data.task_connections?.length || 0
    });
    
    return data;
  } catch (error) {
    console.error("Error analyzing connections:", error);
    return {
      success: false,
      objective_connections: [],
      task_connections: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Apply a batch of suggested connections to the database
 */
export async function batchCreateConnections(
  classId: string,
  connections: ConnectionSuggestion[]
): Promise<ApplyConnectionsResponse> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      console.error("API URL not configured");
      return {
        success: false,
        updated_count: 0,
        error: "API URL not configured"
      };
    }

    console.log(`Applying ${connections.length} connections to class ${classId}`);
    if (connections.length > 0) {
      console.log("Example connection:", connections[0]);
    }
    
    const response = await fetch(`${apiUrl}/learning/apply-connections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        class_id: classId,
        connections
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API responded with status ${response.status}:`, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Apply response:", data);
    return data;
  } catch (error) {
    console.error("Error applying connections:", error);
    return {
      success: false,
      updated_count: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Get suggested connections for tasks from outcomes and objectives
 * Helper function that transforms analysis results
 */
export function getTaskConnections(
  analysisResult: AnalysisResponse
): ConnectionSuggestion[] {
  if (!analysisResult.success) {
    return [];
  }
  return analysisResult.task_connections || [];
}
