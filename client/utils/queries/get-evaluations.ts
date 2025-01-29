import { TypedSupabaseClient } from "../../types";

export async function getEvaluations(client: TypedSupabaseClient, generationId: string) {
    const {data, error} = await client
        .from("evaluations")
        .select("*")
        .eq("generation", generationId)
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}