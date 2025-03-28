/**
 * utils/services/file.ts
 * Functions to perform file related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";
import { FileType } from "@/types";

export const createFile = async (classId: string, title: string, type: FileType, length: number, profile: string) => {
    const supabase = await useSupabaseServer(cookies());
    console.log("Creating file");
    const { data, error } = await supabase
        .from("files")
        .insert({class: classId, title: title, type: type, length: parseInt(length.toString()), profile: profile})
        .select("*")
        .single();
    if (error) {
        throw new Error(error.message);
    }
    return data?.id;
}

export const deleteFile = async (fileId: string) => {
    const supabase = await useSupabaseServer(cookies());
    const { error } = await supabase
        .from("files")
        .update({deleted: true})
        .eq("id", fileId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };

}