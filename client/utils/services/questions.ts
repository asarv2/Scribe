/**
 * utils/services/question.ts
 * Functions to perform question related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";
import { Question } from "@/types";


export const createSlideQuestions = async (slideId: string, questions: { question: string, solution: string }[]) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("questions")
        .insert(questions.map(q => ({ slide: slideId, question: q.question, solution: q.solution })));
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}

export const updateQuestionStatus = async (questionId: string, approved: boolean, rejectionReason?: string) => {
    const supabase = useSupabaseServer(cookies());
    const update_data: { approved: boolean, reason?: string, updated_at: string } = {
        approved: approved,
        updated_at: new Date().toISOString(),
    };
    if (rejectionReason) {
        update_data.reason = rejectionReason;
    }
    const { error } = await supabase
        .from("questions")
        .update(update_data)
        .eq("id", questionId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}

export const createQuestions = async (questions: { generation: string, mcq: boolean, conceptual: boolean, multipart?: string, additional_info: string, references: string[] }[]) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("questions")
        .insert(questions)
        .select()
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}