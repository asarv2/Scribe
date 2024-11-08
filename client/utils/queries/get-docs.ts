import { DocData, TypedSupabaseClient } from "../../types";

export async function getDocs(client: TypedSupabaseClient, lectureId: string): Promise<DocData[] | undefined> {
    const {data, error} = await client
        .from("embeddings")
        .select("id, content, timestamp")
        .eq("lecture", lectureId)
        .order("timestamp", {ascending: true});
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}