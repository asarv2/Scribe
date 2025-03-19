import { TypedSupabaseClient } from "../../types";

export async function getLectures(client: TypedSupabaseClient, classIds: string[], ascending: boolean = true) {
    const {data, error} = await client
        .from("lectures")
        .select("*")
        .in("class", classIds)
        .eq("deleted", false)
        .order("note_number", {ascending: ascending})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}

export async function getLecturesById(client: TypedSupabaseClient, lectureIds: string[]) {
    const {data, error} = await client
        .from("lectures")
        .select("*")
        .in("id", lectureIds)
        .eq("deleted", false)
        .order("note_number", {ascending: true})

    if (error) {
        throw new Error(error.message);
    }
    return data;
}
