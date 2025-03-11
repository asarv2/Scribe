import { TypedSupabaseClient } from "../../types";

export async function getProfiles(client: TypedSupabaseClient) {
    const { data, error } = await client
        .from("profiles")
        .select("*")

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
