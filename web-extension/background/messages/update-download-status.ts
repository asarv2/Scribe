import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { getSupabaseClient } from "~utils/supabase/supabase-client"

interface UpdateDownloadsStatusRequest {
  classId: string
  enabled: boolean
}

interface UpdateDownloadsStatusResponse {
  success: boolean
  message?: string
  error?: string
}

const handler: PlasmoMessaging.MessageHandler<
  UpdateDownloadsStatusRequest,
  UpdateDownloadsStatusResponse
> = async (req, res) => {
  const { classId, enabled } = req.body;
  
  try {
    const client = getSupabaseClient();
    const storage = new Storage();
    const alarmName = `download_course_${classId}`;
    
    // If disabling downloads
    if (!enabled) {
      // Clear the alarm
      await chrome.alarms.clear(alarmName);
      
      // Remove alarm data from storage
      await storage.remove(alarmName);
      
      // Clear SSO refresh alarm
      const ssoRefreshAlarmName = `sso_refresh_${classId}`;
      await chrome.alarms.clear(ssoRefreshAlarmName);
      await storage.remove(ssoRefreshAlarmName);
      
      // Cancel all pending downloads for this class
      await client
        .from('downloads')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('class', classId)
        .eq('status', 'pending');
      
      console.log(`[Background] Cancelled all pending downloads for class ${classId}`);
    }
    
    // Update the class in the database
    await client
      .from('classes')
      .update({
        download: enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', classId);
    
    res.send({
      success: true,
      message: enabled ? 
        `Downloads enabled for class ${classId}` : 
        `Downloads disabled and pending downloads cancelled for class ${classId}`
    });
  } catch (error) {
    console.error("[Background] Error updating downloads status:", error);
    res.send({
      success: false,
      error: error.message || "Failed to update downloads status"
    });
  }
};

export default handler;