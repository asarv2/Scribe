import { TypedSupabaseClient } from "../../types";

export async function getRules(client: TypedSupabaseClient, classId: string) {
    const {data, error} = await client
        .from("rules")
        .select("*")
        .eq("class", classId)
        .order("count", {ascending: false})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}