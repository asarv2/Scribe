import { TypedSupabaseClient } from "../../types";

export async function getQuestions(client: TypedSupabaseClient, classId: string) {
    const {data, error} = await client
        .from("questions")
        .select("*")
        .eq("class", classId)
        .order("created_at", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
} 