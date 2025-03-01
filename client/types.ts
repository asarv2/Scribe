import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA as keyof Database;

export type SchemaName = typeof schema; 
export type TypedSupabaseClient = SupabaseClient<Database>

export type Lecture = Database[SchemaName]["Tables"]["lectures"]["Row"]
export type Textbook = Database[SchemaName]["Tables"]["textbooks"]["Row"]
export type Document = Database[SchemaName]["Tables"]["documents"]["Row"]
export type Chapter = Database[SchemaName]["Tables"]["chapters"]["Row"]
export type Subchapter = Database[SchemaName]["Tables"]["subchapters"]["Row"]
export type Exercise = Database[SchemaName]["Tables"]["exercises"]["Row"]
export type Homework = Database[SchemaName]["Tables"]["homeworks"]["Row"]
export type Problem = Database[SchemaName]["Tables"]["problems"]["Row"]

export type GenerationType = Database[SchemaName]["Enums"]["generation_type"]
export type Message = Database[SchemaName]["Tables"]["messages"]["Row"]
export type Class = Database[SchemaName]["Tables"]["classes"]["Row"]
export type Profile = Database[SchemaName]["Tables"]["profiles"]["Row"]

export type Chat = Database[SchemaName]["Tables"]["chats"]["Row"]
export type ChatType = Database[SchemaName]["Enums"]["chat_type"]
export type Code = Database[SchemaName]["Tables"]["codes"]["Row"]

export type Faqs = Database[SchemaName]["Tables"]["faqs"]["Row"]

export interface ChatMessage {
    id: number;
    title: string
    prompt: string;
    context: {
        lectures: string[];     // lecture IDs
        chapters: string[];    // chapter IDs
        exercises: string[];   // exercise IDs
        homeworks: string[];   // homework IDs
    };
    chatType: ChatType;
    teacher: boolean; // whether the chat is a teacher chat
}

export interface ViewerMode {
    active: boolean;
    documentId?: string;
    lectureId?: string;
    textbookId?: string;
    chapterId?: string;
    exerciseId?: string;
    homeworkId?: string;
}