import { Generation, TypedSupabaseClient } from "../../types";

export async function getGenerationProblems(client: TypedSupabaseClient, generations: Generation[]) {
    const { data, error } = await client
        .from("questions")
        .select("*")
        .in("generation", generations.map(generation => generation.id))
        .order("question", { ascending: false })

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
