import { TypedSupabaseClient } from "../../types";

export async function getClasses(client: TypedSupabaseClient) {
    const {data, error} = await client
        .from("classes")
        .select("*")
        .eq("deleted", false)
        .eq("active", true)
        .order("created_at", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
} 