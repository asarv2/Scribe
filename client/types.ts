import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

export type TypedSupabaseClient = SupabaseClient<Database>
export type Document = Database["public"]["Tables"]["documents"]["Row"]

export type DocumentMetatdata = {
    source: string,
    timestamp: number
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