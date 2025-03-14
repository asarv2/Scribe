/**
 * utils/services/homework.ts
 * Functions to perform homework related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const createHomework = async (classId: string, homeworkTitle: string, homeworkNumber: number, upload_progress: number, response_url: string) => {
    const supabase = useSupabaseServer(cookies());
    console.log("Creating homework", classId, homeworkTitle, homeworkNumber, upload_progress, response_url);
    const { data, error } = await supabase
        .from("homeworks")
        .insert({class: classId, name: homeworkTitle, homework_number: homeworkNumber, upload_progress: upload_progress, response_url: response_url})
        .select("*")
        .single();
    if (error) {
        throw new Error(error.message);
    }
    return data
}

export const deleteHomework = async (homeworkId: string) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("homeworks")
        .update({deleted: true})
        .eq("id", homeworkId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };

}

export const updateHomeworkDate = async (homeworkId: string, due: string) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("homeworks")
        .update({ due: due })
        .eq("id", homeworkId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}

export const updateHomeworkName = async (homeworkId: string, name: string) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("homeworks")
        .update({ title: name })
        .eq("id", homeworkId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}

export const updateHomeworkInstructions = async (homeworkId: string, instructions: string) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("homeworks")
        .update({ additional_info: instructions })
        .eq("id", homeworkId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}