/**
 * utils/services/chat.ts
 * Functions to perform chat related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";
import { ChatType } from "@/types";

export const createChat = async (
    classId: string, 
    chatTitle: string, 
    userId: string | null = null, 
    chatType: ChatType,
    metadata: Record<string, any> = {}
) => {
    const supabase = useSupabaseServer(cookies());
    console.log("Creating chat", classId, chatTitle, "with type:", chatType);
    
    // Store teacher mode info in the name instead of metadata
    let name = chatTitle;
    if (metadata.isTeacherChat) {
        // Add a prefix to the chat name to identify teacher chats
        name = `[T:${metadata.teacherOption || 'approach'}] ${chatTitle}`;
    }
    
    const updates = {
        class: classId,
        name: name,
        type: chatType,
        // Don't include metadata as it doesn't exist in the schema
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
        console.error("Error creating chat:", error);
        throw new Error(error.message);
    }
    
    return data;
};

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