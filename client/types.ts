import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA as keyof Database;

export type SchemaName = typeof schema;
export type TypedSupabaseClient = SupabaseClient<Database>;

export type Document = Database[SchemaName]["Tables"]["documents"]["Row"];

export type GenerationType = Database[SchemaName]["Enums"]["generation_type"];
export type Message = Database[SchemaName]["Tables"]["messages"]["Row"];
export type Class = Database[SchemaName]["Tables"]["classes"]["Row"];
export type Profile = Database[SchemaName]["Tables"]["profiles"]["Row"];

export type Chat = Database[SchemaName]["Tables"]["chats"]["Row"];
export type ChatType = Database[SchemaName]["Enums"]["chat_type_2"];
export type Code = Database[SchemaName]["Tables"]["codes"]["Row"];

export type Figure = Database[SchemaName]["Tables"]["figures"]["Row"];
export type Summary = Database[SchemaName]["Tables"]["summaries"]["Row"];
export type Question = Database[SchemaName]["Tables"]["questions"]["Row"];

export type File = Database[SchemaName]["Tables"]["files"]["Row"];

export type ParseStatus = Database[SchemaName]["Enums"]["parse_status"];

export type FileType = Database[SchemaName]["Enums"]["file_type"];
export type ContentType = Database[SchemaName]["Enums"]["content_type"];

export type OneDrive = Database[SchemaName]["Tables"]["onedrive"]["Row"];

export type Outcome = Database[SchemaName]["Tables"]["outcomes"]["Row"];
export type Objective = Database[SchemaName]["Tables"]["objectives"]["Row"];
export type Usage = Database[SchemaName]["Tables"]["usage"]["Row"];
export type Google = Database[SchemaName]["Tables"]["google"]["Row"];

export interface ChatMessage {
    id: number;
    title: string;
    prompt: string;
    files: string[]; // file ids
    documents: string[]; // document ids (that should be shown separately)
    chatType: ChatType;
    teacher: boolean; // whether the chat is a teacher chat
    rating: number | null;
}

export interface ViewerMode {
    active: boolean; // whether we are on a document
    open: boolean; // whether the viewer is open
    showPageDetails: boolean; // whether the page details are shown
    documentId?: string; // source of truth for document
    fileId?: string; // source of truth for file
}

export interface OneDriveFolder {
    id: string;
    name: string;
    path: string;
    parentId?: string;
    children?: OneDriveFolder[];
    level?: number;
}
