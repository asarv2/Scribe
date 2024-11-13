import { TypedSupabaseClient } from "../../types";

export async function getClass(client: TypedSupabaseClient, classId: string) {
    const {data, error} = await client
        .from("classes")
        .select("*")
        .eq("id", classId)
        .single();
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}