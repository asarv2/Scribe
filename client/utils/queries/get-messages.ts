import { TypedSupabaseClient } from "../../types";

export async function getMessages(client: TypedSupabaseClient, chatIds: string[]) {
    const { data, error } = await client
        .from("messages")
        .select("*")
        .in("chat", chatIds)
        .order("created_at", { ascending: true })

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
