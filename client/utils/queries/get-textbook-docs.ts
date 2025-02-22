import { TypedSupabaseClient } from "../../types";

export async function getTextbookDocuments(client: TypedSupabaseClient, textbookIds: string[], startPage: number = 0, endPage: number = 10000) {
    const {data, error} = await client
        .from("documents")
        .select("*")
        .in("textbook", textbookIds)
        .order("page", {ascending: true})
        .gte("page", startPage)
        .lte("page", endPage)
    if (error) {
        throw new Error(error.message);
    }
    return data;
}