import { SchemaName } from '@/types';
import { Database } from '../../database.types'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export default async function useSupabaseServer(cookieStore: ReturnType<typeof cookies>, useServiceRole: boolean = false) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    useServiceRole ? process.env.SERVICE_ROLE_KEY! : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          return (await cookieStore).getAll().map(cookie => ({ name: cookie.name, value: cookie.value }));
        },
        async setAll(cookiesToSet: { name: string, value: string, options?: any }[]) {
          cookiesToSet.forEach(async ({ name, value, options }) =>
            (await cookieStore).set(name, value, options)
          );
        },
      },
      db: { schema: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA as SchemaName },
      auth: useServiceRole ? {
        autoRefreshToken: false,
        persistSession: false
      } : undefined
    }
  )
}
