import type { Database as DatabaseType } from '~database.types';

const schema = process.env.PLASMO_PUBLIC_SUPABASE_SCHEMA as keyof DatabaseType;

export type SchemaName = typeof schema; 
export type Database = DatabaseType;

export type TypedSupabaseClient = ReturnType<typeof import('@supabase/supabase-js').createClient<Database>>;

export type Class = Database[SchemaName]["Tables"]["classes"]["Row"]
export type Profile = Database[SchemaName]["Tables"]["profiles"]["Row"]