import { TypedSupabaseClient } from "../../types";

export async function getHomework(client: TypedSupabaseClient, homeworkId: string) {
    const {data, error} = await client
        .from("homeworks")
        .select("*")
        .eq("id", homeworkId)
        .single();
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}