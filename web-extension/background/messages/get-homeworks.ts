import type { PlasmoMessaging } from "@plasmohq/messaging"
import type { Homework } from "~types"
import { getSupabaseClient } from '~utils/supabase/supabase-client'

interface GetHomeworksResponse {
  homeworks: Homework[]
}

const handler: PlasmoMessaging.MessageHandler<{ classIds: string[] }, GetHomeworksResponse> = async (req, res) => {
  try {
    // Create the client in the background script
    const client = getSupabaseClient()
    
    const { data, error } = await client
        .from("homeworks")
        .select("*")
        .in("class", req.body.classIds)
        .eq("deleted", false)
        .order("homework_number", {ascending: true})

    if (error) {
        throw new Error(error.message);
    }

    res.send({
      homeworks: data
    })
  } catch (error) {
    console.error('Error in get-homeworks handler:', error);
    // Send an empty array with the error to prevent the extension from breaking
    res.send({
      homeworks: []
    })
  }
}

export default handler