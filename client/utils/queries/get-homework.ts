import { TypedSupabaseClient } from "../../types";

export async function getHomework(client: TypedSupabaseClient, classId: string) {
    const {data, error} = await client
        .from("homework")
        .select("*")
        .eq("class", classId)
        .eq("deleted", false)
        .order("homework_number", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}