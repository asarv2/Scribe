import { TypedSupabaseClient } from "../../types";

export async function getTopic(client: TypedSupabaseClient, topicId: string) {
    const { data, error } = await client
        .from("topics")
        .select("*")
        .eq("id", topicId)
        .single()

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
