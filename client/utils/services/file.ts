/**
 * utils/services/file.ts
 * Functions to perform file related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";
import { FileType } from "@/types";

export const createFile = async (
    classId: string,
    title: string,
    type: FileType,
    length: number,
    profile: string,
) => {
    const supabase = await useSupabaseServer(cookies());
    console.log("Creating file");
    const { data, error } = await supabase
        .from("files")
        .insert({
            class: classId,
            title: title,
            type: type,
            length: parseInt(length.toString()),
            profile: profile,
        })
        .select("*")
        .single();
    if (error) {
        throw new Error(error.message);
    }
    return data?.id;
};

export const deleteFile = async (
    fileId: string,
    deleteFromGemini: boolean = true,
) => {
    const supabase = await useSupabaseServer(cookies());
    const { data, error } = await supabase
        .from("files")
        .update({ deleted: true })
        .eq("id", fileId)
        .select("file_name")
        .single();
    if (error) {
        return { success: false, error: error.message };
    }

    // updating the file itself in google
    if (deleteFromGemini) {
        const apiKey = process.env.GOOGLE_API_KEY;
        const fileName = data?.file_name;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`,
            {
                method: "DELETE",
            },
        );
        if (!response.ok) {
            console.error(
                "Failed to delete file from Gemini: " + response.statusText,
            );
        }
    }
    return { success: true, error: "" };
};
