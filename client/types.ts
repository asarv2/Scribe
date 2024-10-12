import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

export type TypedSupabaseClient = SupabaseClient<Database>

export type Doc = Database["public"]["Tables"]["embeddings"]["Row"]

export type DocData = {
    content: Database["public"]["Tables"]["embeddings"]["Row"]["content"],
    timestamp: Database["public"]["Tables"]["embeddings"]["Row"]["timestamp"]
}

export type SummaryData = {
    heading: string,
    timestamp: string,
    children: {
        subheading: string,
        timestamp: string,
        children: {
            text: string,
            timestamp: string,
        }[]
    }[]
}[]