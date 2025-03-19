import { TypedSupabaseClient } from "../../types";

export async function getTextbooks(client: TypedSupabaseClient, classIds: string[]) {
    const {data, error} = await client
        .from("textbooks")
        .select("*")
        .in("class", classIds)
        .eq("deleted", false)
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}