/**
 * utils/services/auth.ts
 * Used to handle logging in operations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";
import { Code, Profile } from "@/types";

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

export const checkCode = async (code: string): Promise<{ success: boolean, error: string, code: Code | null }> => {
    const supabase = useSupabaseServer(cookies());
    const { data, error } = await supabase.from("codes").select("*").eq("code", code).single();
    if (error) {
        return { success: false, error: "Invalid code", code: null };
    } else {
        if (data) {
            return { success: true, error: "", code: data };
        } else {
            return { success: false, error: "Invalid code", code: null };
        }
    }
}

export const createAnonymousUser = async (firstName: string, lastName: string, classes: string[]) => {
    const supabase = useSupabaseServer(cookies());
    const { data, error } = await supabase.auth.signInAnonymously({
        options: {
            data: {
                first_name: firstName,
                last_name: lastName,
                classes: classes
            },
        },
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

export const updatePassword = async (userId: string, newPassword: string) => {
    const supabase = useSupabaseServer(cookies(), true);
    const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword,
    });
    if (error) {
        return { success: false, error: error.message };
    } else {
        return { success: true, error: "" };
    }
}

export const isProfessor = (profile: Profile, classId: string) => {
    return (profile.professor && profile.classes.includes(classId)) || profile.admin;
}