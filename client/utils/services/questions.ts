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

export const createPracticeExam = async (classId: string, name: string, slideIds: string[], professor: boolean, numQuestions: number) => {
    const supabase = useSupabaseServer(cookies());
    const { data, error } = await supabase
        .from("practice_exams")
        .insert({ class: classId, slides: slideIds, name: name, professor: professor, num_questions: numQuestions })
        .select("*")
        .single();
    if (error) {
        throw error;
    }
    return data;
}

export const deletePracticeExam = async (practiceExamId: string) => {
    const supabase = useSupabaseServer(cookies());
    const { error } = await supabase
        .from("practice_exams")
        .update({ deleted: true })
        .eq("id", practiceExamId);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}

export const createPracticeQuestions = async (practiceExamId: string, questions: { question: string, solution: string }[]) => {
    const supabase = useSupabaseServer(cookies());
    const { data, error } = await supabase
        .from("practice_questions")
        .insert(questions.map(q => ({ practice_exam: practiceExamId, question: q.question, solution: q.solution })));
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, error: "" };
}