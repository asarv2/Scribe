import { PostgrestError } from "@supabase/supabase-js";
import { Chat, TypedSupabaseClient } from "../../types";

export async function getChats(
    client: TypedSupabaseClient,
    classId: string,
    userIds: string[],
) {
    const { data, error } = await client
        .from("chats")
        .select("*")
        .eq("class", classId)
        .eq("deleted", false)
        .in("profile", userIds)
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
