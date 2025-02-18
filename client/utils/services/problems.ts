/**
 * services/problems.ts
 * Problems service for the app.
 * @AshokSaravanan222
 * 02.12.2025
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const updateProblemAnswerEnabled = async (enabled: boolean, problemId: string) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("problems")
        .update({ answer_enabled: enabled })
        .eq("id", problemId);

    if (error) {
        return {success: false, error: error.message};
    }
    return {success: true, error: ""};
}