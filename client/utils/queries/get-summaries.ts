import { TypedSupabaseClient } from "../../types";

export async function getSummaries(client: TypedSupabaseClient, classId: string) {
    const {data, error} = await client
        .from("summaries")
        .select("*")
        .eq("class", classId)
        .order("created_at", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
} 