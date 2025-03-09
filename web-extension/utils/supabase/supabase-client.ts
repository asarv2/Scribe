import { createClient } from '@supabase/supabase-js';
import type { Database, SchemaName, TypedSupabaseClient } from '~types';
import { Storage } from "@plasmohq/storage";

// Use a singleton pattern but allow for forced refresh
let client: TypedSupabaseClient | undefined;

export function getSupabaseClient(forceNew = false): TypedSupabaseClient {
  if (client && !forceNew) {
    return client;
  }

  // Clear the existing client if forcing new
  if (forceNew) {
    client = undefined;
  }

  const plasmoStorage = new Storage({
    area: "local"
  });
  
  client = createClient<Database>(
    process.env.PLASMO_PUBLIC_SUPABASE_URL!,
    process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY!,
    { 
      db: { schema: process.env.PLASMO_PUBLIC_SUPABASE_SCHEMA as SchemaName },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: {
          getItem: async (key) => {
            const value = await plasmoStorage.get(key);
            console.log(`Auth storage getItem: ${key}`, value ? "[value exists]" : "[no value]");
            return value;
          },
          setItem: async (key, value) => {
            console.log(`Auth storage setItem: ${key}`, value ? "[value exists]" : "[no value]");
            await plasmoStorage.set(key, value);
          },
          removeItem: async (key) => {
            console.log(`Auth storage removeItem: ${key}`);
            await plasmoStorage.remove(key);
          }
        }
      }
    }
  );

  return client;
}

// Add a function to clear the client and storage
export async function clearSupabaseClient(): Promise<void> {
  const plasmoStorage = new Storage({
    area: "local"
  });
  
  // Clear auth-related storage keys
  await plasmoStorage.remove("supabase.auth.token");
  await plasmoStorage.remove("supabase.auth.refreshToken");
  
  // Force a new client on next getSupabaseClient call
  client = undefined;
  
  console.log("Supabase client and storage cleared");
}
