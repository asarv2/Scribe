import { TypedSupabaseClient } from "../../types";

export async function getOneDrive(client: TypedSupabaseClient, profileId: string) {
    const { data, error } = await client
        .from("onedrive")
        .select("*")
        .eq("profile", profileId)
        .eq("active", true)

    if (error) {
        throw new Error(error.message);
    }

    return data[0];
}
