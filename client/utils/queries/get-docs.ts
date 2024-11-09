import { DocData, TypedSupabaseClient } from "../../types";

export async function getDocs(client: TypedSupabaseClient, lectureId: string): Promise<DocData[] | undefined> {
    const { data, error } = await client
        .from("embeddings")
        .select("id, content, timestamp")
        .eq("lecture", lectureId)
        .order("timestamp", { ascending: true });

    if (error) {
        throw new Error(error.message);
    }
    return data;
}

export async function getClassDocs(client: TypedSupabaseClient, classId: string): Promise<DocData[] | undefined> {
    const { data: lectures, error: lectureError } = await client
        .from("lectures")
        .select("id")
        .eq("class", classId);

    if (lectureError) {
        throw new Error(lectureError.message);
    }

    const lectureIds = lectures?.map((lecture) => lecture.id);

    const { data, error } = await client
        .from("embeddings")
        .select("id, content, timestamp")
        .in("lecture", lectureIds)
        .order("timestamp", { ascending: true });

    if (error) {
        throw new Error(error.message);
    }

    return data;
}