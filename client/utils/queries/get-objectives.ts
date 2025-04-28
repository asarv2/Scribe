import { TypedSupabaseClient } from "../../types";

export async function getObjectives(client: TypedSupabaseClient, classId: string) {
    const { data, error } = await client
      .from("objectives")
      .select("*")
      .eq("class", classId)
      .eq("deleted", false)
  
    if (error) {
      throw new Error(error.message);
    }
  
    return data;
  }