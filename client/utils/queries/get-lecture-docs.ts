import { TypedSupabaseClient } from "../../types";

export async function getLectureDocuments(client: TypedSupabaseClient, lectureIds: string[]) {
    const {data, error} = await client
        .from("documents")
        .select("*")
        .in("lecture", lectureIds)
        .order("page", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}