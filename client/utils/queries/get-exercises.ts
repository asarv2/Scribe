import { TypedSupabaseClient } from "../../types";

export async function getExercises(client: TypedSupabaseClient, chapters: string[], homeworks: string[]) {
    const {data: chapterExercises, error: chapterError} = await client
        .from("exercises")
        .select("*")
        .in("chapter", chapters)
        .order("exercise_number", {ascending: true})

    const {data: homeworkExercises, error: homeworkError} = await client
        .from("exercises")
        .select("*")
        .in("homework", homeworks)
        .order("exercise_number", {ascending: true})
    
    if (chapterError || homeworkError) {
        throw new Error(chapterError?.message || homeworkError?.message);
    }
    return [...(chapterExercises ?? []), ...(homeworkExercises ?? [])];
}