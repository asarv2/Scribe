import { TypedSupabaseClient } from "../../types";

export async function getDocumentsLecture(client: TypedSupabaseClient, lectureIds: string[]) {
    const {data, error} = await client
        .from("documents")
        .select("*")
        .in("lecture", lectureIds)
        .order("page", { ascending: true })

    if (error) {
        throw new Error(error.message);
    }
    return data;
}