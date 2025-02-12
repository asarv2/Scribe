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
