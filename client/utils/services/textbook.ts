/**
 * utils/services/textbook.ts
 * Functions to get textbook chapters and docs.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const getTextbookDocuments = async (docIds: string[]) => {
    const supabase = useSupabaseServer(cookies());
    const { data, error } = await supabase
        .from("embeddings_textbook")
        .select("*")
        .in("id", docIds);
    if (error) {
        throw new Error(error.message);
    }
    return data;
}