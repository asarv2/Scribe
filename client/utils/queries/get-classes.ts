import { TypedSupabaseClient } from "../../types";

export async function getClasses(client: TypedSupabaseClient) {
    const {data, error} = await client
        .from("classes")
        .select("*")
        .order("created_at", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
} 