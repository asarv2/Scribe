import { TypedSupabaseClient } from "../../types";

export async function getChapter(client: TypedSupabaseClient, chapterId: string) {
    const {data, error} = await client
        .from("chapters")
        .select("*")
        .eq("id", chapterId)
        .single();
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}