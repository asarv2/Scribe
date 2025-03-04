import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

// Initialize the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


export const getClasses = async () => {
  const { data, error } = await supabase
    .from('classes')
    .select('*');

  if (error) {
    console.error('Error fetching classes:', error);
    return [];
  }

  return data;
};
