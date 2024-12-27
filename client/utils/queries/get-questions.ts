import { TypedSupabaseClient } from "../../types";

export async function getLectureQuestions(client: TypedSupabaseClient, lectureId: string) {
    const {data, error} = await client
        .from("questions")
        .select("*")
        .eq("lecture", lectureId)
        .order("created_at", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}

export async function getTopicQuestions(client: TypedSupabaseClient, topicId: string) {
    const {data, error} = await client
        .from("questions")
        .select("*")
        .eq("topic", topicId)
        .order("created_at", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}