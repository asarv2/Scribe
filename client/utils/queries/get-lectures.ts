import { TypedSupabaseClient } from "../../types";

export async function getLectures(client: TypedSupabaseClient, classId: string) {
    const {data, error} = await client
        .from("lectures")
        .select("*")
        .eq("class", classId)
        .eq("deleted", false)
        .order("note_number", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}