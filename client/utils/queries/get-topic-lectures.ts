import { TypedSupabaseClient } from "../../types";

export async function getTopicLectures(client: TypedSupabaseClient, lectureIds: string[]) {
    const {data, error} = await client
        .from("lectures")
        .select("*")
        .in("id", lectureIds)

    if (error) {
        throw new Error(error.message);
    }
    return data;
}