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
  const { courseId, classId, scheduledTime } = req.body;
  
  try {
    const storage = new Storage();
    const alarmName = `download_course_${classId}`;
    
    // Update the stored alarm data with new time
    const alarmData = await storage.get(alarmName) as {
      scheduledTime: string
    };
    if (alarmData) {
      await storage.set(alarmName, {
        ...alarmData,
        scheduledTime
      });
    }
    
    // Clear existing alarm
    await chrome.alarms.clear(alarmName);
    
    // Calculate when to schedule the new alarm
    const [hours, minutes] = scheduledTime.split(":").map(Number);
    const now = new Date();
    const scheduledDate = new Date(now);
    scheduledDate.setHours(hours, minutes, 0, 0);
    
    // If the time has already passed today, schedule for tomorrow
    if (scheduledDate <= now) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }
    
    // Create the new alarm
    chrome.alarms.create(alarmName, {
      when: scheduledDate.getTime(),
      periodInMinutes: 24 * 60 // 24 hours in minutes
    });
    
    // Update any pending downloads in the database
    const client = getSupabaseClient();
    
    // Get pending downloads for this class
    const { data: pendingDownloads } = await client
      .from('downloads')
      .select('*')
      .eq('class', classId)
      .eq('status', 'pending');
      
    if (pendingDownloads && pendingDownloads.length > 0) {
      // Update the next pending download time
      const nextDownload = pendingDownloads[0];
      
      // Create a date object for the next download
      const nextDate = new Date();
      nextDate.setHours(hours, minutes, 0, 0);
      if (nextDate <= now) {
        nextDate.setDate(nextDate.getDate() + 1);
      }

      // update the classes table to have the new download time
      await client
        .from('classes')
        .update({
          download_time: nextDate.toISOString(),
        })
        .eq('id', nextDownload.class);  
    
      // Update the download time
      await client
        .from('downloads')
        .update({
          download_time: nextDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', nextDownload.id);
    }
    
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