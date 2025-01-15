import { TypedSupabaseClient } from "../../types";

export async function getLectures(client: TypedSupabaseClient, classId: string, ascending: boolean = true) {
    const {data, error} = await client
        .from("lectures")
        .select("*")
        .eq("class", classId)
        .eq("deleted", false)
        .order("note_number", {ascending: ascending})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}