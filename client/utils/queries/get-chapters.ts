import { TypedSupabaseClient } from "../../types";

export async function getChapters(client: TypedSupabaseClient, textbookIds: string[]) {
    const {data, error} = await client
        .from("chapters")
        .select("*")
        .in("textbook", textbookIds)
        .order("chapter_number", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
} 