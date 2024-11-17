import { TypedSupabaseClient } from "../../types";

export async function getPracticeExams(client: TypedSupabaseClient, classId: string) {
    const {data, error} = await client
        .from("practice_exams")
        .select("*")
        .eq("class", classId)
        
        .eq("deleted", false);

    if (error) {
        throw new Error(error.message);
    }
    return data;
}