/**
 * client/utils/services/messages.ts
 * This file contains the service for creating messages
 * @AshokSaravanan222
 * 07.02.2025
 */
"use server"
import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const createMessages = async (messages: { generation: string, question: string, references: string[] }[]) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("messages")
        .insert(messages)
        .select()
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}