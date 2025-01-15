import { TypedSupabaseClient } from "../../types";

export async function getGeneration(client: TypedSupabaseClient, generationId: string) {
    const { data, error } = await client
        .from("generations")
        .select("*")
        .eq("id", generationId)
        .single()

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
