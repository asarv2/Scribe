import type { PlasmoMessaging } from "@plasmohq/messaging"
import { getSupabaseServer } from '~utils/supabase/supabase-server'

interface LogoutResponse {
  success: boolean
  error: string
}

const handler: PlasmoMessaging.MessageHandler<{}, LogoutResponse> = async (req, res) => {
  try {
    // Create the server client in the background script
    const client = getSupabaseServer()
    
    const { error } = await client.auth.signOut()
    if (error) {
        throw new Error(error.message);
    }

    res.send({
      success: true,
      error: "",
    })
  } catch (error) {
    console.error('Error in login handler:', error);
    // Send an empty array with the error to prevent the extension from breaking
    res.send({
      success: false,
      error: error.message,
    })
  }
}

export default handler
