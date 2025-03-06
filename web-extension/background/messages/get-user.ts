import type { PlasmoMessaging } from "@plasmohq/messaging"
import type { User } from "~node_modules/@supabase/supabase-js/dist/module"
import { getSupabaseClient } from '~utils/supabase/supabase-client'

interface GetUserResponse {
  user: User
}

const handler: PlasmoMessaging.MessageHandler<{}, GetUserResponse> = async (req, res) => {
  try {
    // Create the client in the background script
    const client = getSupabaseClient()
    
    const { data, error } = await client.auth.getSession()
    if (error) {
        throw new Error(error.message);
    }

    res.send({
      user: data.session?.user ?? null
    })
  } catch (error) {
    console.error('Error in get-user handler:', error);
    // Send an empty array with the error to prevent the extension from breaking
    res.send({
      user: null
    })
  }
}

export default handler
