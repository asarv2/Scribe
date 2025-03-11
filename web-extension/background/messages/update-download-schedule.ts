import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { getSupabaseClient } from "~utils/supabase/supabase-client"

interface UpdateScheduleRequest {
  courseId: string
  courseDescriptor: string
  profileId: string
  classId: string
  scheduledTime: string
}

interface UpdateScheduleResponse {
  success: boolean
  message?: string
  error?: string
}

const handler: PlasmoMessaging.MessageHandler<
  UpdateScheduleRequest,
  UpdateScheduleResponse
> = async (req, res) => {
  const { courseId, courseDescriptor, profileId, classId, scheduledTime } = req.body;
  
  try {
    const storage = new Storage();
    const alarmName = `download_course_${classId}`;
    const ssoRefreshAlarmName = `sso_refresh_${classId}`;
    const client = getSupabaseClient();
    
    console.log(`[Background] Setting up download schedule for class ${classId} at ${scheduledTime}`);
    
    // Store the complete alarm data BEFORE creating the alarm
    await storage.set(alarmName, {
      courseId,
      courseDescriptor,
      profileId,
      classId,
      scheduledTime
    });
    
    console.log(`[Background] Stored alarm data for ${alarmName}:`, {
      courseId,
      courseDescriptor,
      profileId,
      classId,
      scheduledTime
    });

    // Clear existing alarms
    await chrome.alarms.clear(alarmName);
    await chrome.alarms.clear(ssoRefreshAlarmName);
    console.log(`[Background] Cleared existing alarms: ${alarmName}, ${ssoRefreshAlarmName}`);
    
    // Calculate when to schedule the next alarm
    const [hours, minutes] = scheduledTime.split(":").map(Number);
    const now = new Date();
    const scheduledDate = new Date(now);
    scheduledDate.setHours(hours, minutes, 0, 0);
    
    // If the time has already passed today, schedule for tomorrow
    if (scheduledDate <= now) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }
    
    console.log(`[Background] Next download scheduled for: ${scheduledDate.toISOString()}`);
    
    // Create the new download alarm
    chrome.alarms.create(alarmName, {
      when: scheduledDate.getTime(),
      periodInMinutes: 24 * 60 // 24 hours in minutes
    });
    
    // Create SSO refresh alarm to run every hour
    chrome.alarms.create(ssoRefreshAlarmName, {
      periodInMinutes: 120 // Refresh every 120 minutes
    });
    
    // Verify alarms were created
    const allAlarms = await chrome.alarms.getAll();
    console.log('[Background] Current alarms:', allAlarms);
    
    // Update any pending downloads for this class with the new time
    const { data: updateResult, error: updateError } = await client
      .from('downloads')
      .update({
        download_time: scheduledDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('class', classId)
      .eq('status', 'pending');
      
    if (updateError) {
      console.error('[Background] Error updating pending downloads:', updateError);
    } else {
      console.log('[Background] Updated pending downloads with new time');
    }
    
    // Update the classes table with the new download time
    const { data: classUpdate, error: classError } = await client
      .from('classes')
      .update({
        download_time: scheduledTime,
        updated_at: new Date().toISOString()
      })
      .eq('id', classId);
      
    if (classError) {
      console.error('[Background] Error updating class:', classError);
    } else {
      console.log('[Background] Updated class with new schedule');
    }

    // Update the download status refreshed_at to now
    const { data: downloadUpdate, error: downloadError } = await client
      .from('downloads')
      .update({
        refreshed_at: new Date().toISOString()
      })
      .eq('class', classId);

    if (downloadError) {
      console.error('[Background] Error updating download status:', downloadError);
    } else {
      console.log('[Background] Updated download status refreshed_at to now');
    }
    
    // Store SSO refresh data
    await storage.set(ssoRefreshAlarmName, {
      classId,
      courseId,
      lastRefresh: Date.now()
    });
    
    res.send({
      success: true,
      message: `Download schedule updated to run daily at ${scheduledTime}`
    });
  } catch (error) {
    console.error("[Background] Error updating download schedule:", error);
    res.send({
      success: false,
      error: error.message || "Failed to update download schedule"
    });
  }
};

export default handler; 