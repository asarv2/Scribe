import { PostgrestError } from "@supabase/supabase-js";
import { TypedSupabaseClient } from "../../types";

export async function getAllChats(
    client: TypedSupabaseClient,
    classId: string,
) {
    const { data, error } = await client
        .from("chats")
        .select("*")
        .eq("class", classId)
        .eq("deleted", false)
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
