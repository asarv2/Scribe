import type { PlasmoMessaging } from "@plasmohq/messaging"
import { getSupabaseClient } from '~utils/supabase/supabase-client'
import type { Class } from '~types'

interface GetClassesResponse {
  classes: Class[]
}

const handler: PlasmoMessaging.MessageHandler<{}, GetClassesResponse> = async (req, res) => {
  try {
    // Create the client in the background script
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('classes')
      .select('*')
      .eq('deleted', false)
      .eq('active', true)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching classes:', error);
      throw new Error(error.message);
    }

    res.send({
      classes: data || []
    })
  } catch (error) {
    console.error('Error in get-classes handler:', error);
    // Send an empty array with the error to prevent the extension from breaking
    res.send({
      classes: []
    })
  }
}

export default handler
