/**
 * utils/services/query.ts
 * Used to add a question/answer pair to the database.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const createQuery = async (question: string, answer: string): Promise<{ success: boolean, error: string }> => {
    const supabase = useSupabaseServer(cookies());
    const { data, error } = await supabase
        .from("queries")
        .insert({question: question, answer: answer});
    if (error) {
        return { success: false, error: error.message };
    } else {
        return { success: true, error: "" };
    }
}