import { TypedSupabaseClient } from "../../types";

export async function getTopicLectures(client: TypedSupabaseClient, lectureIds: string[]) {
    const {data, error} = await client
        .from("lectures")
        .select("*")
        .in("id", lectureIds)
        .order("note_number", { ascending: true })

    if (error) {
        throw new Error(error.message);
    }
    return data;
}