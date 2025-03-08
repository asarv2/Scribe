import type { PlasmoMessaging } from "@plasmohq/messaging"
import type { Lecture } from "~types"
import { getSupabaseClient } from '~utils/supabase/supabase-client'

interface GetLecturesResponse {
  lectures: Lecture[]
}

const handler: PlasmoMessaging.MessageHandler<{ classIds: string[] }, GetLecturesResponse> = async (req, res) => {
  try {
    // Create the client in the background script
    const client = getSupabaseClient()
    
    const { data, error } = await client
        .from("lectures")
        .select("*")
        .in("class", req.body.classIds)
        .eq("deleted", false)
        .order("note_number", {ascending: true})

    if (error) {
        throw new Error(error.message);
    }

    res.send({
      lectures: data
    })
  } catch (error) {
    console.error('Error in get-lectures handler:', error);
    // Send an empty array with the error to prevent the extension from breaking
    res.send({
      lectures: []
    })
  }
}

export default handler