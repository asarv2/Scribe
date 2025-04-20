/**
 * utils/services/file.ts
 * Functions to perform file related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";
import { ContentType, File, FileType } from "@/types";

export const createFile = async (
    classId: string, 
    fileTitle: string, 
    fileNumber: number, 
    fileType: FileType,
    contentType: ContentType,
    profile: string | null = null
) => {
    const supabase = await useSupabaseServer(cookies());


    const { data, error } = await supabase
        .from("files")
        .insert({
            class: classId,
            length: 1,
            title: fileTitle,
            file_number: fileNumber,
            content_type: contentType,
            type: fileType,
            profile: profile,
            expires: null,
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
        .select("file_names")
        .single();
    if (error) {
        return { success: false, error: error.message };
    }

    // updating the file itself in google
    if (deleteFromGemini) {
        const apiKey = process.env.GOOGLE_API_KEY;
        // get all of the documents for this file
        const { data: documents, error: documentsError } = await supabase
            .from("documents")
            .select("google_file_id, google_expires_at")
            .eq("file", fileId)
            .gte("google_expires_at", new Date().toISOString());
        if (documentsError) {
            return { success: false, error: documentsError.message };
        }
        if (documents) {
            for (const document of documents) {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/files/${document.google_file_id}?key=${apiKey}`,
                    {
                        method: "DELETE",
                    },
                );
                if (!response.ok) {
                    console.error(
                        "Failed to delete file from Gemini: " +
                            response.statusText,
                    );
                    continue;
                }
            }
        }
    }
    return { success: true, error: "" };
};


export const updateFileInfo = async (fileId: string, aiInstructions: string) => {
    const supabase = await useSupabaseServer(cookies());
    const { error } = await supabase
        .from("files")
        .update({additional_info: aiInstructions})
        .eq("id", fileId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}

export const updateFileName = async (fileId: string, fileName: string) => {
    const supabase = await useSupabaseServer(cookies());
    const { error } = await supabase
        .from("files")
        .update({title: fileName})
        .eq("id", fileId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}

export const updateFileDate = async (fileId: string, fileDate: string) => {
    const supabase = await useSupabaseServer(cookies());
    const { error } = await supabase
        .from("files")
        .update({file_date: fileDate})
        .eq("id", fileId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}


export const markFileIdle = async (fileId: string) => {
    const supabase = await useSupabaseServer(cookies());
    const { error } = await supabase
        .from("files")
        .update({parse_status: 'idle'})
        .eq("id", fileId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}