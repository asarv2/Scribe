import { TypedSupabaseClient } from "../../types";

export async function getSlideDocs(client: TypedSupabaseClient, slideId: string) {
    const {data, error} = await client
        .from("embeddings_slide")
        .select("*")
        .eq("slide", slideId)
        .order("page", {ascending: true});
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}