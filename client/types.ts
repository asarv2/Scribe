import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA as keyof Database;

export type SchemaName = typeof schema; 
export type TypedSupabaseClient = SupabaseClient<Database>

export type Lecture = Database[SchemaName]["Tables"]["lectures"]["Row"]
export type Textbook = Database[SchemaName]["Tables"]["textbooks"]["Row"]
export type Document = Database[SchemaName]["Tables"]["documents"]["Row"]
export type Chapter = Database[SchemaName]["Tables"]["chapters"]["Row"]

export type GenerationType = Database[SchemaName]["Enums"]["generation_type"]
export type Message = Database[SchemaName]["Tables"]["messages"]["Row"]
export type Class = Database[SchemaName]["Tables"]["classes"]["Row"]
export type Profile = Database[SchemaName]["Tables"]["profiles"]["Row"]

export type Chat = Database[SchemaName]["Tables"]["chats"]["Row"]

export type Code = Database[SchemaName]["Tables"]["codes"]["Row"]