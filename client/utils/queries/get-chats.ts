import { PostgrestError } from "@supabase/supabase-js";
import { Chat, TypedSupabaseClient } from "../../types";

export async function getChats(client: TypedSupabaseClient, classId: string, userId: string | null) {
    let data: Chat[] | null = null;
    let error: PostgrestError | null = null;
    if (userId) {
        const { data: userData, error: userError } = await client
            .from("chats")
            .select("*")
            .eq("class", classId)
            .eq("deleted", false)
            .eq("profile", userId)
            .order("created_at", { ascending: false });
        data = userData ?? [];
        error = userError ?? null;
    } else {
        const { data: adminData, error: adminError } = await client
            .from("chats")
            .select("*")
            .eq("class", classId)
            .eq("deleted", false)
            .is("profile", null)
            .order("created_at", { ascending: false });
        data = adminData ?? [];
        error = adminError ?? null;
    }

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
