import { createClient } from '@supabase/supabase-js';
import { Database, SchemaName, TypedSupabaseClient } from '../types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';
import { chromeStorageAdapter } from './chrome-storage-adapter';

let client: TypedSupabaseClient | undefined;

export function getSupabaseClient(): TypedSupabaseClient {
  if (client) {
    return client;
  }

  client = createClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    { 
      db: { schema: 'prod' as SchemaName },
      auth: {
        persistSession: true,
        storage: chromeStorageAdapter
      }
    }
  );

  return client;
}
