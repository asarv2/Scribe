import { TypedSupabaseClient } from "../../types";

export async function getLectureDocuments(client: TypedSupabaseClient, lectureId: string) {
    const {data, error} = await client
        .from("documents")
        .select("*")
        .eq("lecture", lectureId)
        .order("page", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}