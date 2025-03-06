// supabase-server.ts
import { createClient } from '@supabase/supabase-js';
import type { Database, SchemaName, TypedSupabaseClient } from '~types';
import { Storage } from "@plasmohq/storage";

let serverClient: TypedSupabaseClient | undefined;

export function getSupabaseServer(useServiceRole: boolean = false): TypedSupabaseClient {
  if (serverClient) {
    return serverClient;
  }

  const plasmoStorage = new Storage();
  
  serverClient = createClient<Database>(
    process.env.PLASMO_PUBLIC_SUPABASE_URL!,
    useServiceRole ? process.env.PLASMO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY! : process.env.PLASMO_PUBLIC_SUPABASE_ANON_KEY!,
    { 
      db: { schema: process.env.PLASMO_PUBLIC_SUPABASE_SCHEMA as SchemaName },
      auth: useServiceRole ? {
        autoRefreshToken: false,
        persistSession: false
      } : {
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

  return serverClient;
}