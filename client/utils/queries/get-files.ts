import { TypedSupabaseClient } from "../../types";

export async function getFiles(client: TypedSupabaseClient, classId: string) {
    const {data, error} = await client
        .from("files")
        .select("*")
        .eq("class", classId)
        .eq("deleted", false)
        .order("file_number", {ascending: false})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}