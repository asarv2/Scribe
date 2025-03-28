/**
 * utils/services/class.ts
 * Functions to perform class related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const updateClassPrivacy = async (classId: string, privacyStatus: boolean) => {
    const supabase = await useSupabaseServer(cookies());
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
    learnModeEnabled: boolean,
    homeworkModeEnabled: boolean,
    testPrepModeEnabled: boolean,
    presentModeEnabled: boolean,
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
    const supabase = await useSupabaseServer(cookies());
    const { error } = await supabase
        .from("classes")
        .update({
            saved: true,
            lecture_prompt: lecturePrompt,
            textbook_prompt: textbookPrompt,
            homework_prompt: homeworkPrompt,
            lecture_enabled: lectureEnabled,
            textbook_enabled: textbookEnabled,
            homework_enabled: homeworkEnabled,
            learn_mode_enabled: learnModeEnabled,
            homework_mode_enabled: homeworkModeEnabled,
            test_prep_mode_enabled: testPrepModeEnabled,
            present_mode_enabled: presentModeEnabled,
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
    const supabase = await useSupabaseServer(cookies());
    const { data, error } = await supabase
        .from("classes")
        .insert({ 
            title: className, 
            class_code: classCode, 
            course_description: classDescription,
        })
        .select("id")
    if (error) {
        return null
    }
    return data[0].id;
}

export const deleteClass = async (classId: string) => {
    const supabase = await useSupabaseServer(cookies());
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
