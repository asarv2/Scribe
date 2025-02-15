import { TypedSupabaseClient } from "../../types";

export async function getProblems(client: TypedSupabaseClient, homeworkIds: string[]) {
    const {data, error} = await client
        .from("problems")
        .select("*")
        .in("homework", homeworkIds)
        .order("problem_number", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}