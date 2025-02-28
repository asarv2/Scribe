import { TypedSupabaseClient } from "../../types";

export async function getCodes(client: TypedSupabaseClient) {
    const {data, error} = await client
        .from("codes")
        .select("*")
        .eq("deleted", false)
        .order("created_at", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
} 