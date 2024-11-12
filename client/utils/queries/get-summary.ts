import { TypedSupabaseClient } from "../../types";

export async function getSummaries(client: TypedSupabaseClient, documentId: string) {
    const {data, error} = await client
        .from("summaries")
        .select("*")
        .eq("slide", documentId)
        .order("created_at", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}