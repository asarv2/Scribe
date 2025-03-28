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

export type Figure = Database[SchemaName]["Tables"]["figures"]["Row"]
export type Summary = Database[SchemaName]["Tables"]["summaries"]["Row"]
export type Question = Database[SchemaName]["Tables"]["questions"]["Row"]

export type Faqs = Database[SchemaName]["Tables"]["faqs"]["Row"]
export type File = Database[SchemaName]["Tables"]["files"]["Row"]

export type ParseStatus = Database[SchemaName]["Enums"]["parse_status"]

export type FileType = Database[SchemaName]["Enums"]["file_type"]

export interface ChatMessage {
    id: number;
    title: string
    prompt: string;
    context: {
        lectures: string[];     // lecture IDs
        chapters: string[];    // chapter IDs
        homeworks: string[];   // homework IDs
        exercises: string[];   // exercise IDs
        files: string[];   // file IDs
    };
    chatType: ChatType;
    teacher: boolean; // whether the chat is a teacher chat
    rating: number | null;
}

export interface ViewerMode {
    active: boolean; // whether we are on a document
    open: boolean; // whether the viewer is open
    immersive: boolean; // whether the viewer is in immersive mode
    documentId?: string; // this goes with either lecture or chapter
    lectureId?: string; // source of truth for lecture
    textbookId?: string; // used soley for chapter convienence
    chapterId?: string; // source of truth for chapter
    exerciseId?: string; // this goes with either chapter or homework
    homeworkId?: string; // source of truth for homework
    fileId?: string; // source of truth for file
}