import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { getSupabaseClient } from "~utils/supabase/supabase-client"

interface UpdateDownloadsStatusRequest {
  classId: string
  enabled: boolean
  responseUrl: string
  profileId: string
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
  const { classId, enabled, responseUrl, profileId } = req.body;
  
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
        .eq('profile', profileId)
        .eq('status', 'pending');
      
      console.log(`[Background] Cancelled all pending downloads for class ${classId}`);
    } else {
      // Get the class details to schedule next download
      const { data: classData } = await client
        .from('classes')
        .select('*')
        .eq('id', classId)
        .single();

      if (classData && classData.download_time) {
        // Calculate the next occurrence of the scheduled time
        const [hours, minutes] = classData.download_time.split(":").map(Number);
        const now = new Date();
        const scheduledDate = new Date(now);
        scheduledDate.setHours(hours, minutes, 0, 0);
        
        // If the time has already passed today, schedule for tomorrow
        if (scheduledDate <= now) {
          scheduledDate.setDate(scheduledDate.getDate() + 1);
        }

        // Create a pending download for the next scheduled time
        await client
          .from('downloads')
          .insert({
            class: classId,
            status: 'pending',
            download_time: scheduledDate.toISOString(),
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
            response_url: responseUrl,
            profile: profileId
          });
      }
    }
    
    // // Update the class in the database
    // await client
    //   .from('classes')
    //   .update({
    //     download: enabled,
    //     updated_at: new Date().toISOString()
    //   })
    //   .eq('id', classId);
    
    res.send({
      success: true,
      message: enabled ? 
        `Downloads enabled and scheduled for class ${classId}` : 
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