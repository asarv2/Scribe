import { TypedSupabaseClient } from "../../types";

export async function getTextbooks(client: TypedSupabaseClient, classId: string) {
    const {data, error} = await client
        .from("textbooks")
        .select("*")
        .eq("class", classId)
        .order("created_at", {ascending: true});
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}