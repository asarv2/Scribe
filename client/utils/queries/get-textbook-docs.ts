import { TypedSupabaseClient } from "../../types";

export async function getTextbookDocs(client: TypedSupabaseClient, textbookId: string) {
    const {data, error} = await client
        .from("embeddings_textbook")
        .select("*")
        .eq("textbook", textbookId)
        .order("page", {ascending: true});
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}