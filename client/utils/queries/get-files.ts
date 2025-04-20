import { TypedSupabaseClient } from "../../types";

export async function getFiles(client: TypedSupabaseClient, classIds: string[]) {
    const {data, error} = await client
        .from("files")
        .select("*")
        .in("class", classIds)
        .eq("deleted", false)
        .order("file_number", {ascending: false})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}