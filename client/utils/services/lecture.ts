/**
 * utils/services/lecture.ts
 * Functions to perform lecture related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const createSlide = async (classId: string, slideTitle: string, slideNumber: number) => {
    const supabase = useSupabaseServer(cookies());
    const { data, error } = await supabase
        .from("slides")
        .insert({class: classId, name: slideTitle, note_number: slideNumber})
        .select("id, name")
        .single();
    if (error) {
        throw new Error(error.message);
    }
    return data;
}

export const deleteSlide = async (slideId: string) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("slides")
        .update({deleted: true})
        .eq("id", slideId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };

}