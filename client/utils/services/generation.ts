/**
 * utils/services/generation.ts
 * Functions to perform generation related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";
import { GenerationType } from "@/types";

export const createGeneration = async (classId: string, generationTitle: string, generationType: GenerationType, lectures: string[], topics: string[], numQuestions: number, mcq: boolean, conceptual: boolean, single: boolean, additional_info: string, response_url: string) => {
    const supabase = useSupabaseServer(cookies());
    const { data, error } = await supabase
        .from("generations")
        .insert({class: classId, name: generationTitle, type: generationType, lectures: lectures, topics: topics, num_questions: numQuestions, mcq: mcq, conceptual: conceptual, single: single, additional_info: additional_info, response_url: response_url})
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