/**
 * services/profile.ts
 * Profile service for the app.
 * @AshokSaravanan222
 * 02.12.2025
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const updateAvatar = async (formData: FormData, userId: string) => {
    const supabase = useSupabaseServer(cookies());
    const file = formData.get("file") as File;
    const { data, error } = await supabase.storage.from("profiles").upload(`${userId}.png`, file);
    if (error) {
        return {success: false, error: error.message};
    }
    return {success: true, error: ""};
}

export const checkEmail = async (email: string) => {
    const supabase = useSupabaseServer(cookies());
    const { data, error } = await supabase.from("profiles").select("*").eq("email", email).eq("admin", false);
    if (error) {
        return {success: false, error: error.message, profile: null};
    } else {
        return {success: true, error: "", profile: data[0]};
    }
}

export const updateClasses = async (userId: string, classes: string[]) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase.from("profiles").update({ classes: classes }).eq("id", userId);
    if (error) {
        return {success: false, error: error.message};
    } else {
        return {success: true, error: ""};
    }
}

export const updateProfile = async (userId: string, data: any) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase.from("profiles").update(data).eq("id", userId);
    if (error) {
        return {success: false, error: error.message};
    } else {
        return {success: true, error: ""};
    }
}
