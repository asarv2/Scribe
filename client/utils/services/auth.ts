/**
 * utils/services/auth.ts
 * Used to handle logging in operations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";
import { Code, Profile } from "@/types";
import { User } from "@supabase/supabase-js";

export const login = async (email: string, password: string): Promise<{ success: boolean, error: string, user: User | null }> => {
    const supabase = await useSupabaseServer(cookies());
    const { error, data } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });
    if (error) {
        return { success: false, error: error.message, user: null };
    } else {
        return { success: true, error: "", user: data.user };
    }
}

export const createAnonymousUser = async (firstName: string, lastName: string, email: string, classes: string[], oldId?: string): Promise<{ success: boolean, error: string, user: User | null }> => {
    const supabase = await useSupabaseServer(cookies());
    const { data, error } = await supabase.auth.signInAnonymously({
        options: {
            data: {
                old_id: oldId,
                first_name: firstName,
                last_name: lastName,
                email: email,
                classes: classes
            },
        },
    });
    if (error) {
        return { success: false, error: error.message, user: null };
    } else {
        return { success: true, error: "", user: data.user };
    }
}

export const logout = async (): Promise<{ success: boolean, error: string }> => {
    const supabase = await useSupabaseServer(cookies());
    const { error } = await supabase.auth.signOut();
    if (error) {
        return { success: false, error: error.message };
    } else {
        return { success: true, error: "" };
    }
}

export const updatePassword = async (userId: string, newPassword: string) => {
    const supabase = await useSupabaseServer(cookies(), true);
    const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword,
    });
    if (error) {
        return { success: false, error: error.message };
    } else {
        return { success: true, error: "" };
    }
}

export const deleteAccount = async (userId: string): Promise<{ success: boolean, error: string }> => {
    const supabase = await useSupabaseServer(cookies(), true);
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
        return { success: false, error: error.message };
    } else {
        return { success: true, error: "" };
    }
}

export const signInWithMicrosoft = async (redirectTo: string): Promise<{ success: boolean, error: string, url: string | null }> => {
    const supabase = await useSupabaseServer(cookies());
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
            scopes: 'email',
            queryParams: {
                domain_hint: 'purdue.edu',
            },
            redirectTo: `${redirectTo}`
        },
    });
    if (error) {
        return { success: false, error: error.message, url: null };
    } else {
        return { success: true, error: "", url: data.url };
    }
}

export const signInWithMicrosoftProfessor = async (redirectTo: string): Promise<{ success: boolean, error: string, url: string | null }> => {
    const supabase = await useSupabaseServer(cookies());
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
            scopes: 'openid profile email offline_access Files.Read',
            queryParams: {
                domain_hint: 'purdue.edu',
            },
            redirectTo: `${redirectTo}`
        },
    });
    if (error) {
        return { success: false, error: error.message, url: null };
    } else {
        return { success: true, error: "", url: data.url };
    }
}

export const signInWithSSO = async (): Promise<{ success: boolean, error: string, url: string | null }> => {
    const supabase = await useSupabaseServer(cookies());
    const { data, error } = await supabase.auth.signInWithSSO({
        domain: 'purdue.edu'
    })
    if (error) {
        return { success: false, error: error.message, url: null };
    } else {
        return { success: true, error: "", url: data.url };
    }
}
