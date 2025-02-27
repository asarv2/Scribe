import { TypedSupabaseClient } from "../../types";

export async function getExerciseDocuments(client: TypedSupabaseClient, exerciseIds: string[]) {
    const {data, error} = await client
        .from("documents")
        .select("*")
        .in("exercise", exerciseIds)
        .order("page", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}