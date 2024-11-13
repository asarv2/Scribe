import { TypedSupabaseClient } from "../../types";

export async function getSlide(client: TypedSupabaseClient, slideId: string) {
    const {data, error} = await client
        .from("slides")
        .select("*")
        .eq("id", slideId)
        .single();
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}