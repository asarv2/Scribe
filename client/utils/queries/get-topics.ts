import { TypedSupabaseClient } from "../../types";

export async function getTopics(client: TypedSupabaseClient, classId: string) {
    const { data, error } = await client
        .from("topics")
        .select("*")
        .eq("class", classId)

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
