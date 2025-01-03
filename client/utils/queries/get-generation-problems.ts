import { TypedSupabaseClient } from "../../types";

export async function getGenerationProblems(client: TypedSupabaseClient, generationId: string) {
    const { data, error } = await client
        .from("questions")
        .select("*")
        .eq("generation", generationId)

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
