import { TypedSupabaseClient } from "../../types";

export async function getPracticeExam(client: TypedSupabaseClient, examId: string) {
    const {data, error} = await client
        .from("practice_exams")
        .select("*")
        .eq("id", examId)
        .single();
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}