import { TypedSupabaseClient } from "../../types";

export async function getAlerts(client: TypedSupabaseClient) {
    const {data, error} = await client
        .from("documents")
        .select("*")
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}