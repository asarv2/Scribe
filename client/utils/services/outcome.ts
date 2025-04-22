/**
 * utils/services/class.ts
 * Functions to perform class related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const addOutcome = async (classId: string, title: string) => {
    const supabase = await useSupabaseServer(cookies());
    const { error } = await supabase.from("outcomes").insert({ class: classId, title: title });
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}

export const updateOutcome = async (outcomeId: string, title: string, description: string) => {
    const supabase = await useSupabaseServer(cookies());
    const { error } = await supabase.from("outcomes").update({ title: title, description: description }).eq("id", outcomeId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}

export const deleteOutcome = async (outcomeId: string) => {
    const supabase = await useSupabaseServer(cookies());
    const { error } = await supabase.from("outcomes").update({ deleted: true }).eq("id", outcomeId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}