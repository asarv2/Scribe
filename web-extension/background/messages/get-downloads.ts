import type { PlasmoMessaging } from "@plasmohq/messaging"
import { getSupabaseClient } from '~utils/supabase/supabase-client'
import type { Download } from '~types'

interface GetDownloadsResponse {
  downloads: Download[]
  
}

const handler: PlasmoMessaging.MessageHandler<{}, GetDownloadsResponse> = async (req, res) => {
  try {
    // Create the client in the background script
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('downloads')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching downloads:', error);
      throw new Error(error.message);
    }

    res.send({
      downloads: data || []
    })
  } catch (error) {
    console.error('Error in get-downloads handler:', error);
    // Send an empty array with the error to prevent the extension from breaking
    res.send({
      downloads: []
    })
  }
}

export default handler
