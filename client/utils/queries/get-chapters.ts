import { TypedSupabaseClient } from "../../types";

export async function getChapters(client: TypedSupabaseClient, textbookId: string) {
    const {data, error} = await client
        .from("chapters")
        .select("*")
        .eq("textbook", textbookId)
        .order("chapter_number", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
} 