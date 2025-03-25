import { TypedSupabaseClient } from "../../types";

export async function getFiles(client: TypedSupabaseClient, classIds: string[]) {
    const {data, error} = await client
        .from("files")
        .select("*")
        .in("class", classIds)
        .order("created_at", {ascending: false})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}