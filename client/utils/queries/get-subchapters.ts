import { TypedSupabaseClient } from "../../types";

export async function getSubchapters(client: TypedSupabaseClient, chapterIds: string[]) {
    const {data, error} = await client
        .from("subchapters")
        .select("*")
        .in("chapter", chapterIds)
        .order("subchapter_number", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
} 