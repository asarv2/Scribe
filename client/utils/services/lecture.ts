/**
 * utils/services/lecture.ts
 * Functions to perform lecture related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const createLecture = async (classId: string, lectureTitle: string, lectureNumber: number, numPages: number, upload_progress: number, response_url: string) => {
    const supabase = useSupabaseServer(cookies());
    console.log("Creating lecture", classId, lectureTitle, lectureNumber, numPages, response_url);
    const { data, error } = await supabase
        .from("lectures")
        .insert({class: classId, name: lectureTitle, note_number: lectureNumber, pages: numPages, upload_progress: upload_progress, response_url: response_url})
        .select("*")
        .single();
    if (error) {
        throw new Error(error.message);
    }
    return data
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