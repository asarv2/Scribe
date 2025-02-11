import { TypedSupabaseClient } from "../../types";

export async function getProfile(client: TypedSupabaseClient, userId: string) {
    const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
