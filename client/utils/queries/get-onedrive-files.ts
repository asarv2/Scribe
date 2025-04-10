import { TypedSupabaseClient } from "../../types";

export async function getOnedriveFiles(client: TypedSupabaseClient, classId: string) {
    const {data, error} = await client
        .from("onedrive_files")
        .select("*")
        .eq("class", classId)
        .eq("active", true)
        .order("created_at", {ascending: true})

    if (error) {
        throw new Error(error.message);
    }
    return data;
}