import type { PlasmoMessaging } from "@plasmohq/messaging"
import { getSupabaseClient } from '~utils/supabase/supabase-client'
import type { Class } from '~types'

interface CreateClassResponse {
  class: Class
}

const handler: PlasmoMessaging.MessageHandler<{
  title: string
  brightspace_course_id: number
  brightspace_course_descriptor: string
}, CreateClassResponse> = async (req, res) => {
  try {
    // Create the client in the background script
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('classes')
      .insert({
        title: req.body.title,
        brightspace_course_id: req.body.brightspace_course_id,
        brightspace_course_descriptor: req.body.brightspace_course_descriptor,
      })
      .select('*')
    
    if (error) {
      console.error('Error fetching classes:', error);
      throw new Error(error.message);
    }

    res.send({
      class: data[0]
    })
  } catch (error) {
    console.error('Error in get-classes handler:', error);
    // Send an empty array with the error to prevent the extension from breaking
    res.send({
      class: null
    })
  }
}

export default handler
