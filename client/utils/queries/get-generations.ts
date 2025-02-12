import { TypedSupabaseClient, GenerationType, Generation } from "../../types";
import { PostgrestError } from "@supabase/supabase-js";

export async function getGenerations(
    client: TypedSupabaseClient,
    classId: string,
    type: GenerationType,
    userId: string | null = null
) {
    let data: Generation[] | null = null;
    let error: PostgrestError | null = null;
    if (userId) {
        const { data: userData, error: userError } = await client
            .from("generations")
            .select("*")
            .eq("class", classId)
            .eq("type", type)
            .eq("deleted", false)
            .eq("profile", userId)
            .order("created_at", { ascending: false });
        data = userData ?? [];
        error = userError ?? null;
    } else {
        const { data: adminData, error: adminError } = await client
            .from("generations")
            .select("*")
            .eq("class", classId)
            .eq("type", type)
            .eq("deleted", false)
            .is("profile", null)
            .order("created_at", { ascending: false });
        data = adminData ?? [];
        error = adminError ?? null;
    }

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

