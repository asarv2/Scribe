/**
 * utils/services/lecture.ts
 * Functions to perform lecture related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const createLecture = async (classId: string, lectureTitle: string, lectureNumber: number) => {
    const supabase = useSupabaseServer(cookies());
    const { data, error } = await supabase
        .from("lectures")
        .insert({class: classId, name: lectureTitle, note_number: lectureNumber})
        .select("id, name")
        .single();
    if (error) {
        throw new Error(error.message);
    }
    return data;
}

export const deleteLecture = async (lectureId: string) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("lectures")
        .update({deleted: true})
        .eq("id", lectureId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };

}