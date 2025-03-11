import { TypedSupabaseClient } from "../../types";

export async function getLectureRules(client: TypedSupabaseClient, lectureId: string) {
    const {data, error} = await client
        .from("rules")
        .select("*")
        .eq("lecture", lectureId)
        .order("count", {ascending: false})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}