import { TypedSupabaseClient } from "../../types";

export async function getExercises(client: TypedSupabaseClient, chapterIds: string[]) {
    const {data, error} = await client
        .from("exercises")
        .select("*")
        .in("chapter", chapterIds)
        .order("exercise_number", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}