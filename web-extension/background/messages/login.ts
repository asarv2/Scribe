import type { PlasmoMessaging } from "@plasmohq/messaging"
import type { User } from "~node_modules/@supabase/supabase-js/dist/module"
import { getSupabaseServer } from '~utils/supabase/supabase-server'

interface LoginResponse {
  success: boolean
  error: string
  user: User | null
}

const handler: PlasmoMessaging.MessageHandler<{ email: string, password: string }, LoginResponse> = async (req, res) => {
  try {
    // Create the server client in the background script
    const client = getSupabaseServer()
    
    const { data, error } = await client.auth.signInWithPassword({
        email: req.body.email,
        password: req.body.password,
    })
    if (error) {
        throw new Error(error.message);
    }

    res.send({
      success: true,
      error: "",
      user: data.session?.user ?? null
    })
  } catch (error) {
    console.error('Error in login handler:', error);
    // Send an empty array with the error to prevent the extension from breaking
    res.send({
      success: false,
      error: error.message,
      user: null
    })
  }
}

export default handler
