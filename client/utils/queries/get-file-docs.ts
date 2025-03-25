import { TypedSupabaseClient } from "../../types";

export async function getFileDocuments(client: TypedSupabaseClient, fileIds: string[]) {
    const {data, error} = await client
        .from("documents")
        .select("*")
        .in("file", fileIds)
        .order("page", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}