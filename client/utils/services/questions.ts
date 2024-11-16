/**
 * utils/services/question.ts
 * Functions to perform question related mutations.
 */
"use server";

import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";


export const createSlideQuestions = async (slideId: string, questions: { question: string, solution: string }[]) => {
    const supabase = useSupabaseServer(cookies());
    const { data, error } = await supabase
        .from("questions")
        .insert(questions.map(q => ({ slide: slideId, question: q.question, solution: q.solution })));
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}

export const createPracticeQuestions = async (slideId: string, questions: { question: string, solution: string }[]) => {
    const supabase = useSupabaseServer(cookies());
    const { data, error } = await supabase
        .from("practice_questions")
        .insert(questions.map(q => ({ slide: slideId, question: q.question, solution: q.solution })));
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}