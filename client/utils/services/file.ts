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
    classId: string,
    fileId: string,
    deleteFromGemini: boolean = true,
    deleteFromSupabase: boolean = true,
) => {
    const supabase = await useSupabaseServer(cookies());
    
    // Mark file as deleted in the database
    const { data, error } = await supabase
        .from("files")
        .update({ deleted: true })
        .eq("id", fileId)
        .select("extension")
    if (error) {
        return { success: false, error: error.message };
    }
    if (!data) {
        return { success: false, error: "File not found" };
    }
    
    const fileExtension = data[0].extension || '';
    
    // Delete from Gemini
    if (deleteFromGemini) {
        const apiKey = process.env.GOOGLE_API_KEY;
        // Get all of the documents for this file
        const { data: googleData, error: googleError } = await supabase
            .from("google")
            .select("google_id")
            .eq("file", fileId)
        if (googleError) {
            return { success: false, error: googleError.message };
        }
        
        let deletedGoogleIds: string[] = [];
        if (googleData) {
            for (const google of googleData) {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/${google.google_id}?key=${apiKey}`,
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
                deletedGoogleIds.push(google.google_id);
            }
        }
        
        // Update the google table
        if (deletedGoogleIds.length > 0) {
            const { error: googleUpdateError } = await supabase
                .from("google")
                .update({ deleted: true })
                .in("google_id", deletedGoogleIds)
            if (googleUpdateError) {
                return { success: false, error: googleUpdateError.message };
            }
        }
    }

    // Delete from Supabase Storage
    if (deleteFromSupabase) {
        try {
            const filesToDelete = [];
            
            // 1. Add the main file with its extension
            filesToDelete.push(`${classId}/${fileId}${fileExtension}`);
            
            // 2. Get all documents for this file to delete their images
            const { data: documents, error: documentsError } = await supabase
                .from("documents")
                .select("id")
                .eq("file", fileId);
                
            if (documentsError) {
                console.error("Error getting documents:", documentsError.message);
            } else if (documents && documents.length > 0) {
                // Add all document images (they all end with .png)
                const documentImages = documents.map(doc => `${classId}/${fileId}/${doc.id}.png`);
                filesToDelete.push(...documentImages);
            }
            
            // Delete all files in a single operation
            if (filesToDelete.length > 0) {
                const { error: deleteError } = await supabase
                    .storage
                    .from('files')
                    .remove(filesToDelete);
                    
                if (deleteError) {
                    console.error("Error deleting files from storage:", deleteError.message);
                } else {
                    console.log(`Successfully deleted ${filesToDelete.length} files from storage`);
                }
            }
        } catch (storageError) {
            console.error("Error during storage deletion:", storageError);
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