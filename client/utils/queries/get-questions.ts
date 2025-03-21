import { TypedSupabaseClient } from "../../types";

export async function getQuestions(client: TypedSupabaseClient, messageIds: string[]) {
    const {data, error} = await client
        .from("questions")
        .select("*")
        .in("message", messageIds)
        .order("created_at", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
} 