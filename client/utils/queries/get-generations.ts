import { TypedSupabaseClient, GenerationType } from "../../types";

export async function getGenerations(
    client: TypedSupabaseClient,
    classId: string,
    type: GenerationType
) {
    const { data, error } = await client
    .from("generations")
    .select("*")
    .eq("class", classId)
    .eq("type", type)
    .eq("deleted", false)
    .order("created_at", { ascending: false });

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
