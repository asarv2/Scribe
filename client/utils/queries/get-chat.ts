import { TypedSupabaseClient } from "../../types";

export async function getChat(client: TypedSupabaseClient, chatId: string) {
    const { data, error } = await client
        .from("chats")
        .select("*")
        .eq("id", chatId)
        .single()

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
