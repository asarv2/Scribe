/**
 * utils/services/lecture.ts
 * Functions to perform lecture related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const createLecture = async (classId: string, lectureTitle: string, lectureNumber: number, numPages: number, upload_progress: number, response_url: string, has_audio: boolean) => {
    const supabase = useSupabaseServer(cookies());
    console.log("Creating lecture", classId, lectureTitle, lectureNumber, numPages, response_url);
    const { data, error } = await supabase
        .from("lectures")
        .insert({class: classId, name: lectureTitle, note_number: lectureNumber, pages: numPages, upload_progress: upload_progress, response_url: response_url, has_audio: has_audio})
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

export const updateLectureInfo = async (lectureId: string, aiInstructions: string) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("lectures")
        .update({additional_info: aiInstructions})
        .eq("id", lectureId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}

export const updateLectureName = async (lectureId: string, lectureName: string) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("lectures")
        .update({name: lectureName})
        .eq("id", lectureId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}

export const updateLectureDate = async (lectureId: string, lectureDate: string) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("lectures")
        .update({lecture_date: lectureDate})
        .eq("id", lectureId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}