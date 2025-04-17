/**
 * utils/services/code.ts
 * Functions to perform code related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";
import crypto from "crypto";
import { Code } from "@/types";

export const createCode = async (userId: string, classId: string) => {
    const supabase = await useSupabaseServer(cookies());

    try {
        // Define characters to use (excluding similar-looking characters)
        const charset = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Removed 0,1,I,O for clarity

        // Generate a 10-character code
        let code = "";
        const timestamp = Date.now().toString();
        const dataToHash = userId + timestamp + classId;

        // Create a seed based on user data
        const hash = crypto.createHash("sha256").update(dataToHash).digest();

        // Use the hash to generate 10 random characters
        for (let i = 0; i < 10; i++) {
            const randomByte = hash[i % hash.length];
            code += charset[randomByte % charset.length];
        }

        // Insert groups of 5 for readability (e.g., ABCDE-12345)
        const formattedCode = `${code.slice(0, 5)}-${code.slice(5)}`;

        const { data, error } = await supabase
            .from("codes")
            .insert({
                code: formattedCode,
                class: classId,
            })
            .select("*")
            .single();
        if (error) {
            throw new Error(error.message);
        }
        return { success: true, error: "", code: data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

export const deleteCode = async (codeId: string) => {
    const supabase = await useSupabaseServer(cookies());
    const { error } = await supabase
        .from("codes")
        .update({ deleted: true })
        .eq("id", codeId);

    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
};

export const checkCode = async (code: string): Promise<{ success: boolean, error: string, code: Code | null }> => {
    const supabase = await useSupabaseServer(cookies());
    const { data, error } = await supabase.from("codes").select("*").eq("code", code);
    if (error) {
        return { success: false, error: "Error checking code: " + error.message, code: null };
    } else {
        if (data && data.length == 1) {
            const code = data[0];
            if (code.deleted === false) {
                return { success: true, error: "", code: code };
            } else {
                return { success: false, error: "Code has been deleted", code: null };
            }
        } else {
            return { success: false, error: "Invalid code", code: null };
        }
    }
}
