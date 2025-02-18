import { TypedSupabaseClient } from "../../types";

export async function getProfessor(client: TypedSupabaseClient, classId: string) {
    const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("professor", true)
        .contains("classes", [classId])

    if (error || data?.length === 0) {
        throw new Error(error?.message ?? "No professor found");
    }

    return data[0];
}
