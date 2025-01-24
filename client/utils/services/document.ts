/**
 * utils/services/document.ts
 * Functions to perform document related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const createTextbookDocument = async (textbookId: string, pageNumber: number, text: string) => {
    const supabase = useSupabaseServer(cookies());
    const { data, error } = await supabase
        .from("documents")
        .insert({textbook: textbookId, page: pageNumber, text: text})
        .select("id")
        .single();
    if (error) {
        return { success: false, error: error.message, documentId: null };
    }
    return { success: true, error: "", documentId: data.id };
}