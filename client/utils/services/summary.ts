/**
 * utils/services/summary.ts
 * Will handle generating summaries for each lecture.
 */

"use server"

import useSupabaseServer from "../supabase/supabase-server";
import { cookies } from "next/headers";

export const createSummary = async (lectureId: string, response: string) => {
    const supabase = useSupabaseServer(cookies());

    const { error } = await supabase
        .from('summaries')
        .insert({ content: response, lecture: lectureId });

    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}


