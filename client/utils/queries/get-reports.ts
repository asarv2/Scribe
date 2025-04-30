import { TypedSupabaseClient } from "../../types";

export async function getReports(client: TypedSupabaseClient, classId: string) {
    const {data, error} = await client
        .from("reports")
        .select("*")
        .eq("class", classId)
        .order("created_at", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
} 