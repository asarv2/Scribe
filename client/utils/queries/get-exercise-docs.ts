import { TypedSupabaseClient } from "../../types";

export async function getExerciseDocuments(client: TypedSupabaseClient, exerciseIds: string[]) {
    const {data, error} = await client
        .from("documents")
        .select("*")
        .contains("exercises", exerciseIds)
        .order("page", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}