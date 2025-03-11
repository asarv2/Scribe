import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

interface LogoutResponse {
  success: boolean
  error: string
}

const handler: PlasmoMessaging.MessageHandler<{}, LogoutResponse> = async (req, res) => {
  try {
    console.log("Logout attempt - using direct storage clearing approach");
    
    // Directly clear all auth-related storage
    const storage = new Storage({ area: "local" });
    
    // Clear all Supabase auth tokens
    await storage.remove("sb-hmdqtnywfebxjugxzlvc-auth-token");
    await storage.remove("supabase.auth.token");
    await storage.remove("supabase.auth.refreshToken");
    
    // Clear any other auth-related keys
    const allKeys = await storage.getAll();
    for (const key of Object.keys(allKeys)) {
      if (key.includes('auth') || key.includes('token')) {
        await storage.remove(key);
      }
    }
    
    console.log("Storage cleared successfully");
    
    // Send success response before any navigation happens
    res.send({
      success: true,
      error: ""
    });
    
    // Instead of reloading the extension, we'll let the UI handle navigation
  } catch (error) {
    console.error('Error in logout handler:', error);
    res.send({
      success: false,
      error: error.message || "An unexpected error occurred"
    });
  }
}

export default handler
