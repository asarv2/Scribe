import { TypedSupabaseClient } from "../../types";

export async function getTopics(client: TypedSupabaseClient, classId: string, map: string | null) {
    if (!map) {
        return [];
    }

    const { data, error } = await client
        .from("topics")
        .select("*")
        .eq("class", classId)
        .eq("map", map)

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
