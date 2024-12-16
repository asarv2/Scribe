/**
 * utils/services/auth.ts
 * Used to handle logging in operations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const login = async (email: string, password: string): Promise<{ success: boolean, error: string }> => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });
    if (error) {
        return { success: false, error: error.message };
    } else {
        return { success: true, error: "" };
    }
}

export const logout = async (): Promise<{ success: boolean, error: string }> => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase.auth.signOut();
    if (error) {
        return { success: false, error: error.message };
    } else {
        return { success: true, error: "" };
    }
}