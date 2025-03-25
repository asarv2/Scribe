import { TypedSupabaseClient } from "../../types";

export async function getFigures(client: TypedSupabaseClient, messageIds: string[]) {
    const {data, error} = await client
        .from("figures")
        .select("*")
        .in("message", messageIds)
        .order("created_at", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
} 