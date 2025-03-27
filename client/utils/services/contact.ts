/**
 * utils/services/contact.ts
 * This file is used to send contact information to the server
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";

export const submitContact = async (name: string, email: string, message: string) => {
    const supabase = await useSupabaseServer(cookies());
    const { error } = await supabase.from("contact").insert({ 
        name: name, 
        email: email, 
        message: message,
    });
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
};
