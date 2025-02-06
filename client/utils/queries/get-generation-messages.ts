import { Generation, TypedSupabaseClient } from "../../types";

export async function getGenerationMessages(client: TypedSupabaseClient, generations: Generation[]) {
    const { data, error } = await client
        .from("messages")
        .select("*")
        .in("generation", generations.map(generation => generation.id))
        .order("created_at", { ascending: true })

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
