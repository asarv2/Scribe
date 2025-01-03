import { TypedSupabaseClient } from "../../types";

export async function getGenerationSummary(client: TypedSupabaseClient, generationId: string) {
    const { data, error } = await client
        .from("summaries")
        .select("*")
        .eq("generation", generationId)
        .single()

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
