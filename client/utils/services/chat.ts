/**
 * utils/services/chat.ts
 * Functions to perform chat related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const createChat = async (classId: string, chatTitle: string, userId: string | null = null) => {
    const supabase = useSupabaseServer(cookies());
    console.log("Creating chat", classId, chatTitle);
    const updates = {
        class: classId,
        name: chatTitle,
    } as any;
    if (userId) {
        updates["profile"] = userId;
    }
    const { data, error } = await supabase
        .from("chats")
        .insert(updates)
        .select("*")
        .single();
    if (error) {
        throw new Error(error.message);
    }
    return data
}

export const deleteChat = async (chatId: string) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("chats")
        .update({deleted: true})
        .eq("id", chatId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };

}