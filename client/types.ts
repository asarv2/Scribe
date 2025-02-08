import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA as keyof Database;

export type SchemaName = typeof schema; 
export type TypedSupabaseClient = SupabaseClient<Database>

export type Lecture = Database[SchemaName]["Tables"]["lectures"]["Row"]
export type Textbook = Database[SchemaName]["Tables"]["textbooks"]["Row"]
export type Topic = Database[SchemaName]["Tables"]["topics"]["Row"]
export type Question = Database[SchemaName]["Tables"]["questions"]["Row"]
export type Summary = Database[SchemaName]["Tables"]["summaries"]["Row"]
export type Document = Database[SchemaName]["Tables"]["documents"]["Row"]
export type Figure = Database[SchemaName]["Tables"]["figures"]["Row"]
export type Chapter = Database[SchemaName]["Tables"]["chapters"]["Row"]

export type Generation = Database[SchemaName]["Tables"]["generations"]["Row"]
export type GenerationType = Database[SchemaName]["Enums"]["generation_type"]
export type Evaluation = Database[SchemaName]["Tables"]["evaluations"]["Row"]
export type Message = Database[SchemaName]["Tables"]["messages"]["Row"]