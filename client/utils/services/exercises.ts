/**
 * services/problems.ts
 * Problems service for the app.
 * @AshokSaravanan222
 * 02.12.2025
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const updateExerciseAnswerEnabled = async (enabled: boolean, exerciseId: string) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("exercises")
        .update({ answer_enabled: enabled })
        .eq("id", exerciseId);

    if (error) {
        return {success: false, error: error.message};
    }
    return {success: true, error: ""};
}