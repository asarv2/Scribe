import { TypedSupabaseClient } from "../../types";

export async function getTextbooks(client: TypedSupabaseClient, classId: string) {
    const {data, error} = await client
        .from("textbooks")
        .select("*")
        .eq("class", classId)
        .eq("deleted", false)
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}