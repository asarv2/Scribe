/**
 * utils/services/class.ts
 * Functions to perform class related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const updateClassPrivacy = async (classId: string, privacyStatus: boolean) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("classes")
        .update({privacy: privacyStatus})
        .eq("id", classId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}