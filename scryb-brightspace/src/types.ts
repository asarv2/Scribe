import { Database as DatabaseType } from "../database.types";

const schema = process.env.SUPABASE_SCHEMA as keyof DatabaseType;

export type SchemaName = typeof schema; 
export type Database = DatabaseType;

export type TypedSupabaseClient = ReturnType<typeof import('@supabase/supabase-js').createClient<Database>>;