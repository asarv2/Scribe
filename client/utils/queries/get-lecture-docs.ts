import { TypedSupabaseClient } from "../../types";

export async function getLectureDocs(client: TypedSupabaseClient, lectureId: string) {
    const {data, error} = await client
        .from("embeddings_lecture")
        .select("*")
        .eq("lecture", lectureId)
        .order("timestamp", {ascending: true});
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}