import { TypedSupabaseClient } from "../../types";

export async function getFile(client: TypedSupabaseClient, fileId: string) {
    const {data, error} = await client
        .from("files")
        .select("*")
        .eq("id", fileId)
        .single()
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}