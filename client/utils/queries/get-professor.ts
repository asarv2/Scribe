import { TypedSupabaseClient } from "../../types";

export async function getProfessor(client: TypedSupabaseClient, classId: string) {
    const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("professor", true)
        .contains("classes", [classId])
        .single()

    if (error) {
        throw new Error(error.message);
    }

    return data;
}
