import { Database } from '../../database.types'
import { createBrowserClient } from '@supabase/ssr'
import { useMemo } from 'react'
import { SchemaName, TypedSupabaseClient } from '../../types'

let client: TypedSupabaseClient | undefined

function getSupabaseBrowserClient() {
  if (client) {
    return client
  }

  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA as SchemaName } }
  )

  return client
}

function useSupabaseBrowser() {
  return useMemo(getSupabaseBrowserClient, [])
}

export default useSupabaseBrowser