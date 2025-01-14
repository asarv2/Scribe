import { TypedSupabaseClient } from "../../types";

export async function getGenerationDocuments(client: TypedSupabaseClient, documentIds: string[]) {
    const { data, error } = await client
        .from("documents")
        .select("*")
        .in("id", documentIds)
    if (error) {
        throw new Error(error.message);
    }
    return data;
}
