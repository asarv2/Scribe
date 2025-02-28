import { TypedSupabaseClient } from "../../types";

export async function getStudents(client: TypedSupabaseClient, classId: string) {
    const { data, error } = await client
        .from("profiles")
        .select("*")
        .contains("classes", [classId])
        .eq("admin", false)
        .eq("professor", false)

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
