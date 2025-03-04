import { createClient } from '@supabase/supabase-js';
import type { Database, SchemaName, TypedSupabaseClient } from '~types';
import { Storage } from "@plasmohq/storage";

let client: TypedSupabaseClient | undefined;

export function getSupabaseClient(): TypedSupabaseClient {
  if (client) {
    return client;
  }

  const plasmoStorage = new Storage();
  
  client = createClient<Database>(
    process.env.PLASMO_PUBLIC_SUPABASE_URL!,
    process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY!,
    { 
      db: { schema: process.env.PLASMO_PUBLIC_SUPABASE_SCHEMA as SchemaName },
      auth: {
        persistSession: true,
        storage: {
          getItem: async (key) => {
            return await plasmoStorage.get(key);
          },
          setItem: async (key, value) => {
            await plasmoStorage.set(key, value);
          },
          removeItem: async (key) => {
            await plasmoStorage.remove(key);
          }
        }
      }
    }
  );

  return client;
}
