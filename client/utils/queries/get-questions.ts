import { TypedSupabaseClient } from "../../types";

export async function getQuestions(client: TypedSupabaseClient, slideId: string) {
    const {data, error} = await client
        .from("questions")
        .select("*")
        .eq("slide", slideId)
        .order("created_at", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}