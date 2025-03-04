import { getSupabaseClient } from '../supabase-client';

export async function getClasses() {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from('classes')
    .select('*')
    .eq('deleted', false)
    .eq('active', true)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching classes:', error);
    throw new Error(error.message);
  }
  
  return data;
}
