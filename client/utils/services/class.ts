/**
 * utils/services/class.ts
 * Functions to perform class related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const updateClassPrivacy = async (classId: string, privacyStatus: boolean) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("classes")
        .update({privacy: privacyStatus})
        .eq("id", classId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}

export const updateClassPrompts = async (
    classId: string,
    lecturePrompt: string,
    textbookPrompt: string,
    homeworkPrompt: string,
    lectureEnabled: boolean = false,
    textbookEnabled: boolean = false,
    homeworkEnabled: boolean = false,
    title: string,
    class_code: string,
    course_description: string,
    download: boolean,
    download_time: string,
    privateMode: boolean
) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("classes")
        .update({
            lecture_prompt: lecturePrompt,
            textbook_prompt: textbookPrompt,
            homework_prompt: homeworkPrompt,
            lecture_enabled: lectureEnabled,
            textbook_enabled: textbookEnabled,
            homework_enabled: homeworkEnabled,
            title,
            class_code,
            course_description,
            download,
            download_time,
            privacy: privateMode
        })
        .eq("id", classId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}

export const createClass = async (
    className: string,
    classCode: string,
    classDescription: string
) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("classes")
        .insert({ 
            title: className, 
            class_code: classCode, 
            course_description: classDescription,
        });
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}

export const deleteClass = async (classId: string) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("classes")
        .update({
            deleted: true
        })
        .eq("id", classId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}
