import { TypedSupabaseClient } from "../../types";

export async function getHomeworkDocuments(client: TypedSupabaseClient, homeworkIds: string[]) {
    const {data, error} = await client
        .from("documents")
        .select("*")
        .in("homework", homeworkIds)
        .order("page", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}