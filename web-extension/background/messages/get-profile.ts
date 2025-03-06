import type { PlasmoMessaging } from "@plasmohq/messaging"
import type { Profile } from "~types"
import { getSupabaseClient } from '~utils/supabase/supabase-client'

interface GetProfileResponse {
  profile: Profile
}

const handler: PlasmoMessaging.MessageHandler<{ userId: string }, GetProfileResponse> = async (req, res) => {
  try {
    // Create the client in the background script
    const client = getSupabaseClient()
    
    const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("id", req.body.userId)
        .single()

    if (error) {
        throw new Error(error.message);
    }

    res.send({
      profile: data
    })
  } catch (error) {
    console.error('Error in get-profile handler:', error);
    // Send an empty array with the error to prevent the extension from breaking
    res.send({
      profile: null
    })
  }
}

export default handler
