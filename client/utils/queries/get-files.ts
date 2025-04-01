import { TypedSupabaseClient } from "../../types";

export async function getFiles(client: TypedSupabaseClient, profileId: string, classIds: string[]) {
    const {data, error} = await client
        .from("files")
        .select("*")
        .in("class", classIds)
        .eq("profile", profileId)
        .eq("deleted", false)
        .gte("expires", new Date().toISOString())
        .order("created_at", {ascending: false})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}