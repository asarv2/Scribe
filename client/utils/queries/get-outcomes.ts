import { TypedSupabaseClient } from "../../types";

export async function getOutcomes(client: TypedSupabaseClient, classId: string) {
    const { data, error } = await client
      .from("outcomes")
      .select("*")
      .eq("class", classId)
      .eq("deleted", false)
  
    if (error) {
      throw new Error(error.message);
    }
  
    return data;
  }