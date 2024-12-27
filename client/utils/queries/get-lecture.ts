import { TypedSupabaseClient } from "../../types";

export async function getLecture(client: TypedSupabaseClient, lectureId: string) {
    const {data, error} = await client
        .from("lectures")
        .select("*")
        .eq("id", lectureId)
        .single();
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}