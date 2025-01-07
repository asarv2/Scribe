import { TypedSupabaseClient } from "../../types";

export async function getGenerations(client: TypedSupabaseClient, classId: string) {
    const { data, error } = await client
        .from("generations")
        .select("*")
        .eq("class", classId)
        .eq("deleted", false)
        .order("created_at", { ascending: false })
        
    if (error) {
        throw new Error(error.message);
    }

    return data;
}
