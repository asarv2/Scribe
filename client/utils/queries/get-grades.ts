import { TypedSupabaseClient } from "../../types";

export async function getGrades(client: TypedSupabaseClient, messageIds: string[]) {
    const {data, error} = await client
        .from("grades")
        .select("*")
        .in("message", messageIds)
        .order("created_at", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
} 