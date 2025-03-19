import { TypedSupabaseClient } from "../../types";

export async function getHomeworks(client: TypedSupabaseClient, classIds: string[]) {
    const {data, error} = await client
        .from("homeworks")
        .select("*")
        .in("class", classIds)
        .eq("deleted", false)
        .order("homework_number", {ascending: true})
    
    if (error) {
        throw new Error(error.message);
    }
    return data;
}

export async function getHomeworksById(client: TypedSupabaseClient, homeworkIds: string[]) {
    const {data, error} = await client
        .from("homeworks")
        .select("*")
        .in("id", homeworkIds)
        .eq("deleted", false)
        .order("homework_number", {ascending: true})

    if (error) {
        throw new Error(error.message);
    }
    return data;
}
