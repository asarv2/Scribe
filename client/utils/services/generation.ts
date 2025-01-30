/**
 * utils/services/generation.ts
 * Functions to perform generation related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";
import { GenerationType } from "@/types";

export const createGeneration = async (classId: string, generationTitle: string, generationType: GenerationType, response_url: string, base_generation_id: string | null = null, version: number | null = null) => {
    const supabase = useSupabaseServer(cookies());
    const updates = {
        class: classId,
        name: generationTitle,
        type: generationType,
        response_url: response_url
    } as any;
    if (base_generation_id) {
        updates["base_generation_id"] = base_generation_id;
    }
    if (version) {
        updates["version"] = version;
    }
    const { data, error } = await supabase
        .from("generations")
        .insert(updates)
        .select("id, name")
        .single();
    if (error) {
        throw new Error(error.message);
    }
    return data;
}

export const deleteGeneration = async (generationId: string) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("generations")
        .update({deleted: true})
        .eq("id", generationId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };

}