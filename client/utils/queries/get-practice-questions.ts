import { TypedSupabaseClient } from "../../types";

export async function getPracticeQuestions(client: TypedSupabaseClient, examId: string) {
    const {data, error} = await client
        .from("practice_questions")
        .select("*")
        .eq("practice_exam", examId)
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}