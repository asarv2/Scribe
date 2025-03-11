import { getSupabaseClient } from '~utils/supabase/supabase-client';

// Initialize Supabase client and restore session on extension startup
(async function initializeAuth() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error("Error restoring session:", error);
    } else if (data.session) {
      console.log("Session restored successfully");
    }
  } catch (error) {
    console.error("Failed to initialize auth:", error);
  }
})(); 