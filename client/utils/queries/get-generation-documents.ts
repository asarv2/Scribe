import { Figure, TypedSupabaseClient } from "../../types";

export async function getGenerationDocuments(client: TypedSupabaseClient, classId: string, figures: Figure[]) {
    const { data, error } = await client
        .from("documents")
        .select("*")
        .in("id", figures.map(figure => figure.document))
    if (error) {
        throw new Error(error.message);
    }
    return data;
}
