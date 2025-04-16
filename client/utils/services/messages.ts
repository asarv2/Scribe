/**
 * client/utils/services/messages.ts
 * This file contains the service for creating messages
 * @AshokSaravanan222
 * 07.02.2025
 */
"use server"
import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const createMessages = async (messages: { chat: string, bare_question: string, question: string, files: string[] }[]) => {
    const supabase = await useSupabaseServer(cookies());
    const { data, error } = await supabase
        .from("messages")
        .insert(messages)
        .select("id")
    if (error) {
        return { success: false, error: error.message, data: null };
    }
    return { success: true, error: "", data: data };
}