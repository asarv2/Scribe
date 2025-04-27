import { TypedSupabaseClient } from "../../types";

export async function getProfile(client: TypedSupabaseClient, userId: string) {
    const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle() // Use maybeSingle instead of single to handle cases where profile doesn't exist

    if (error) {
        throw new Error(error.message);
    }

    // If no profile exists, return a default empty profile structure
    if (!data) {
        return {
            id: userId,
            classes: [],
            professor: false,
            admin: false,
            first_name: "",
            last_name: "",
            email: ""
        };
    }

    return data;
}
