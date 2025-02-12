import { TypedSupabaseClient } from "../../types";

export async function getSummaries(client: TypedSupabaseClient, documentId: string) {
    const {data, error} = await client
        .from("documents")
        .select("description")
        .eq("lecture", documentId)
        .order("created_at", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}