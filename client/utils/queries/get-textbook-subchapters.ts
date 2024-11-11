import { TypedSupabaseClient } from "../../types";

export async function getTextbookSubchapters(client: TypedSupabaseClient, chapterId: string) {
    const {data, error} = await client
        .from("subchapters")
        .select("*")
        .eq("chapter", chapterId)
        .order("section_number", {ascending: true});
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}