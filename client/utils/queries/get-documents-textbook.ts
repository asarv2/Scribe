import { TypedSupabaseClient } from "../../types";

export async function getDocumentsTextbook(client: TypedSupabaseClient, textbookIds: string[]) {
    const {data, error} = await client
        .from("documents")
        .select("*")
        .in("textbook", textbookIds)
        .order("page", { ascending: true })

    if (error) {
        throw new Error(error.message);
    }
    return data;
}