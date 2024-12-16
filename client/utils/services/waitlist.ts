/**
 * utils/services/waitlist.ts
 * Function to join the waitlist.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";




export const joinWaitlist = async (email: string): Promise<{ success: boolean, error: string }> => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("waitlist")
        .insert({email: email});
    if (error) {
        return { success: false, error: error.message };
    } else {
        return { success: true, error: "" };
    }
}