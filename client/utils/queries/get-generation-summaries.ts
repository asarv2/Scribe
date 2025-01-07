import { Generation, TypedSupabaseClient } from "../../types";

export async function getGenerationSummaries(client: TypedSupabaseClient, generations: Generation[]) {
    const { data, error } = await client
        .from("summaries")
        .select("*")
        .in("generation", generations.map(generation => generation.id))

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
