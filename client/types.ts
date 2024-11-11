import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

export type TypedSupabaseClient = SupabaseClient<Database>

export type Lecture = Database["public"]["Tables"]["lectures"]["Row"]
export type Slide = Database["public"]["Tables"]["slides"]["Row"]
export type Textbook = Database["public"]["Tables"]["textbooks"]["Row"]

export type Chapter = Database["public"]["Tables"]["chapters"]["Row"]

export type LectureData = Database["public"]["Tables"]["embeddings_lecture"]["Row"]
export type SlideData = Database["public"]["Tables"]["embeddings_slide"]["Row"]
export type TextbookData = Database["public"]["Tables"]["embeddings_textbook"]["Row"]

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