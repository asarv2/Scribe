import { TypedSupabaseClient } from "../../types";

export async function getFigures(client: TypedSupabaseClient, documentIds: string[]) {
    const {data, error} = await client
        .from("figures")
        .select("*")
        .in("document", documentIds)
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}