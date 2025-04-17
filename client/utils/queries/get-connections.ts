import { Lecture, Objective, Outcome, TypedSupabaseClient } from "../../types";

// Get all outcomes for a class
export async function getOutcomes(client: TypedSupabaseClient, classId: string): Promise<Outcome[]> {
  const { data, error } = await client
    .from("outcomes")
    .select("*")
    .eq("class", classId);

  if (error) {
    console.error("Error fetching outcomes:", error);
    return [];
  }

  return data || [];
}

// Get all objectives for a class
export async function getObjectives(client: TypedSupabaseClient, classId: string): Promise<Objective[]> {
  try {
    // Try to select with the connection handle columns
    const { data, error } = await client
      .from("objectives")
      .select("*")
      .eq("class", classId);

    // Return empty array on error, properly log it
    if (error) {
      console.error("Error fetching objectives:", error);
      return [];
    }

    // Map the data to ensure it has the expected properties even if columns don't exist yet
    return data || [];
  } catch (err) {
    console.error("Exception fetching objectives:", err);
    return [];
  }
}

// Get all lectures for a class
export async function getLectures(client: TypedSupabaseClient, classId: string): Promise<Lecture[]> {
  const { data, error } = await client
    .from("lectures")
    .select("*")
    .eq("class", classId);

  if (error) {
    console.error("Error fetching lectures:", error);
    return [];
  }

  return data || [];
}

// Create a new outcome
export async function createOutcome(
  client: TypedSupabaseClient, 
  outcome: Omit<Outcome, "id" | "created_at">
): Promise<Outcome | null> {
  const { data, error } = await client
    .from("outcomes")
    .insert(outcome)
    .select()
    .single();

  if (error) {
    console.error("Error creating outcome:", error);
    return null;
  }

  return data;
}

// Update an existing outcome
export async function updateOutcome(
  client: TypedSupabaseClient, 
  id: string, 
  updates: Partial<Outcome>
): Promise<boolean> {
  const { error } = await client
    .from("outcomes")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("Error updating outcome:", error);
    return false;
  }

  return true;
}

// Delete an outcome - improved with more robust error handling
export async function deleteOutcome(
  client: TypedSupabaseClient, 
  id: string
): Promise<boolean> {
  try {
    console.log(`[UTILS] Attempting to delete outcome with ID:`, id, "Type:", typeof id);

    // First, check if the record exists
    const { data: existingData, error: checkError } = await client
      .from("outcomes")
      .select("id")
      .eq("id", id)
      .single();

    if (checkError) {
      console.error("[UTILS] Error checking if outcome exists:", checkError);
      return false;
    }

    if (!existingData) {
      console.error("[UTILS] Outcome doesn't exist or you don't have permission to view it");
      return false;
    }

    console.log("[UTILS] Found outcome, proceeding with deletion");

    // Try the delete operation
    const { error: deleteError } = await client
      .from("outcomes")
      .delete()
      .eq("id", id);

    // Log detailed information about the response
    console.log("[UTILS] Delete outcome response complete");

    if (deleteError) {
      console.error("[UTILS] Error deleting outcome:", deleteError);
      return false;
    }

    // If we get here, assume success since there was no error
    console.log(`[UTILS] Successfully deleted outcome ${id}`);
    return true;
  } catch (err) {
    console.error("[UTILS] Exception when deleting outcome:", err);
    return false;
  }
}

// Create a new objective
export async function createObjective(
  client: TypedSupabaseClient, 
  objective: Omit<Objective, "id" | "created_at">
): Promise<Objective | null> {
  const { data, error } = await client
    .from("objectives")
    .insert(objective)
    .select()
    .single();

  if (error) {
    console.error("Error creating objective:", error);
    return null;
  }

  return data;
}

// Update an existing objective
export async function updateObjective(
  client: TypedSupabaseClient, 
  id: string, 
  updates: Partial<Objective>
): Promise<boolean> {
  const { error } = await client
    .from("objectives")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("Error updating objective:", error);
    return false;
  }

  return true;
}

// Delete an objective - improved with more robust error handling
export async function deleteObjective(
  client: TypedSupabaseClient, 
  id: string
): Promise<boolean> {
  try {
    console.log(`[UTILS] Attempting to delete objective with ID:`, id, "Type:", typeof id);

    // First, check if the record exists
    const { data: existingData, error: checkError } = await client
      .from("objectives")
      .select("id")
      .eq("id", id)
      .single();

    if (checkError) {
      console.error("[UTILS] Error checking if objective exists:", checkError);
      return false;
    }

    if (!existingData) {
      console.error("[UTILS] Objective doesn't exist or you don't have permission to view it");
      return false;
    }

    console.log("[UTILS] Found objective, proceeding with deletion");

    // Try the delete operation without the count - simpler approach
    const { error: deleteError } = await client
      .from("objectives")
      .delete()
      .eq("id", id);

    // Log detailed information about the response
    console.log("[UTILS] Delete objective response complete");

    if (deleteError) {
      console.error("[UTILS] Error deleting objective:", deleteError);
      return false;
    }

    // If we get here, assume success since there was no error
    console.log(`[UTILS] Successfully deleted objective ${id}`);
    return true;
  } catch (err) {
    console.error("[UTILS] Exception when deleting objective:", err);
    return false;
  }
}

// Update the connection between an objective and an outcome
// Update this function to handle potential missing columns
export async function updateObjectiveConnection(
  client: TypedSupabaseClient, 
  objectiveId: string, 
  outcomeId: string | null,
  metadata?: {
    source_handle?: string;
    target_handle?: string;
  }
): Promise<boolean> {
  try {
    // First try updating just the outcome_id to ensure basic functionality
    const baseUpdate = { outcome_id: outcomeId };
    
    // Then try to add the handle metadata if provided
    const fullUpdate = metadata ? {
      ...baseUpdate,
      connection_source_handle: metadata.source_handle || null,
      connection_target_handle: metadata.target_handle || null
    } : baseUpdate;
    
    const { error } = await client
      .from("objectives")
      .update(fullUpdate)
      .eq("id", objectiveId);

    if (error) {
      console.error("Error updating objective connection:", error);
      
      // If error might be related to missing columns, fall back to basic update
      if (metadata && (error.message?.includes('column') || error.code === '42703')) {
        console.log("Falling back to basic connection update without handle data");
        const { error: fallbackError } = await client
          .from("objectives")
          .update(baseUpdate)
          .eq("id", objectiveId);
          
        if (fallbackError) {
          console.error("Error in fallback update:", fallbackError);
          return false;
        }
        return true;
      }
      
      return false;
    }

    return true;
  } catch (err) {
    console.error("Exception updating objective connection:", err);
    return false;
  }
}
