import type { PlasmoMessaging } from "@plasmohq/messaging"
import type { Textbook } from "~types"
import { getSupabaseClient } from '~utils/supabase/supabase-client'

interface GetTextbooksResponse {
  textbooks: Textbook[]
}

const handler: PlasmoMessaging.MessageHandler<{ classIds: string[] }, GetTextbooksResponse> = async (req, res) => {
  try {
    // Create the client in the background script
    const client = getSupabaseClient()
    
    const { data, error } = await client
        .from("textbooks")
        .select("*")
        .in("class", req.body.classIds)
        .eq("deleted", false)
        .order("textbook_number", {ascending: true})

    if (error) {
        throw new Error(error.message);
    }

    res.send({
      textbooks: data
    })
  } catch (error) {
    console.error('Error in get-textbooks handler:', error);
    // Send an empty array with the error to prevent the extension from breaking
    res.send({
      textbooks: []
    })
  }
}

export default handler