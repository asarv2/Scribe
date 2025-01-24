/**
 * utils/services/textbook.ts
 * Functions to perform textbook related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const createTextbook = async (classId: string, textbookTitle: string, numPages: number) => {
    const supabase = useSupabaseServer(cookies());
    console.log("Creating textbook", classId, textbookTitle, numPages);
    const { data, error } = await supabase
        .from("textbooks")
        .insert({class: classId, title: textbookTitle, pages: numPages})
        .select("*")
        .single();
    if (error) {
        throw new Error(error.message);
    }
    return data
}

export const deleteTextbook = async (textbookId: string) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("textbooks")
        .update({deleted: true})
        .eq("id", textbookId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };

}