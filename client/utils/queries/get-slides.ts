import { TypedSupabaseClient } from "../../types";

export async function getSlides(client: TypedSupabaseClient, classId: string) {
    const {data, error} = await client
        .from("slides")
        .select("*")
        .eq("class", classId)
        .eq("deleted", false)
        .order("note_number", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}