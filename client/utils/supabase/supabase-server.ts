import { SchemaName } from '@/types';
import { Database } from '../../database.types'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export default function useSupabaseServer(cookieStore: ReturnType<typeof cookies>) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map(cookie => ({ name: cookie.name, value: cookie.value }));
        },
        setAll(cookiesToSet: { name: string, value: string, options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
      db: { schema: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA as SchemaName }
    }
  )
}
