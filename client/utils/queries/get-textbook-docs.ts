import { TypedSupabaseClient } from "../../types";

export async function getTextbookDocuments(client: TypedSupabaseClient, textbookId: string) {
    const {data, error} = await client
        .from("documents")
        .select("*")
        .eq("textbook", textbookId)
        .order("page", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}