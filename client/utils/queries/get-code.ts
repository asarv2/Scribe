import { TypedSupabaseClient } from "../../types";

export async function getCode(client: TypedSupabaseClient, classId: string) {
    const {data, error} = await client
        .from("codes")
        .select("*")
        .eq("class", classId)
        .eq("deleted", false)
        .order("created_at", {ascending: true})
    
    if (error || !data || data.length === 0) {
        return null;
    }
    return data[0];
} 