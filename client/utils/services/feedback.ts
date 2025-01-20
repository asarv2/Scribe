/**
 * utils/services/feedback.ts
 * This file is used to send feedback to the server
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const submitFeedback = async (positive: string, negative: string, feature: string) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase.from("feedback").insert({ positive, negative, feature });
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
};