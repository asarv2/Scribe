/**
 * utils/services/lecture.ts
 * Functions to perform lecture related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";
import { FileType } from "@/types";

export const createLecture = async (classId: string, lectureTitle: string, lectureNumber: number, fileType: FileType, response_url: string) => {
    const supabase = await useSupabaseServer(cookies());
    console.log("Creating lecture", classId, lectureTitle, lectureNumber, response_url);
    const { data, error } = await supabase
        .from("lectures")
        .insert({class: classId, name: lectureTitle, note_number: lectureNumber, type: fileType, response_url: response_url})
        .select("*")
        .single();
    if (error) {
        throw new Error(error.message);
    }
    return data?.id;
}

export const deleteLecture = async (lectureId: string) => {
    const supabase = await useSupabaseServer(cookies());
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
    const supabase = await useSupabaseServer(cookies());
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
    const supabase = await useSupabaseServer(cookies());
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
    const supabase = await useSupabaseServer(cookies());
    const { error } = await supabase
        .from("lectures")
        .update({lecture_date: lectureDate})
        .eq("id", lectureId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}