import { TypedSupabaseClient } from "../../types";

export async function getChapterDocuments(client: TypedSupabaseClient, chapterIds: string[]) {
    const {data, error} = await client
        .from("documents")
        .select("*")
        .in("chapter", chapterIds)
        .order("page", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}