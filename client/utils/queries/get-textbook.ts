import { TypedSupabaseClient } from "../../types";

export async function getTextbook(client: TypedSupabaseClient, textbookId: string) {
    const {data, error} = await client
        .from("textbooks")
        .select("*")
        .eq("id", textbookId)
        .single();
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}