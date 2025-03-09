import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { getSupabaseClient } from "~utils/supabase/supabase-client"

interface DownloadCourseRequest {
  courseId: string
  courseDescriptor: string
  profileId: string
}

interface DownloadItem {
  url: string
  filename: string
}

interface DownloadCourseResponse {
  success: boolean
  message?: string
  downloads?: DownloadItem[]
  error?: string
}

// Update the interface for alarm data
interface DownloadAlarmData {
  courseId: string
  courseDescriptor: string
  profileId: string
  classId: string
  scheduledTime: string // Store time as "HH:MM" format
}

// Add interface for SSO refresh alarm data
interface SSORefreshAlarmData {
  classId: string
  courseId: string
  lastRefresh: number // timestamp of last refresh
}

const handler: PlasmoMessaging.MessageHandler<
  { courseId: string; courseDescriptor: string; profileId: string; classId: string; scheduledTime?: string },
  DownloadCourseResponse
> = async (req, res) => {
  const { courseId, courseDescriptor, profileId, classId, scheduledTime = "08:00" } = req.body;
  
  // Set up the alarm to run daily at the specified time
  const alarmName = `download_course_${classId}`;
  const storage = new Storage();
  
  // Store the download parameters for the alarm to use
  await storage.set(alarmName, {
    courseId,
    courseDescriptor,
    profileId,
    classId,
    scheduledTime
  });
  
  // Calculate when to schedule the first alarm
  const [hours, minutes] = scheduledTime.split(":").map(Number);
  const now = new Date();
  const scheduledDate = new Date(now);
  scheduledDate.setHours(hours, minutes, 0, 0);
  
  // If the time has already passed today, schedule for tomorrow
  if (scheduledDate <= now) {
    scheduledDate.setDate(scheduledDate.getDate() + 1);
  }
  
  // Create the alarm
  chrome.alarms.create(alarmName, {
    when: scheduledDate.getTime(),
    periodInMinutes: 24 * 60 // 24 hours in minutes
  });
  
  console.log(`[Background] Created alarm ${alarmName} to download course ${courseId} daily at ${scheduledTime}`);
  
  // Create a pending download entry for the next scheduled download
  await createPendingDownload(classId, scheduledDate.toISOString());
  
  // Set up SSO refresh alarm to run hourly until the scheduled download
  setupSSORefreshAlarm(courseId, classId, scheduledDate.getTime());
  
  // Start the first download immediately
  await performDownload(courseId, courseDescriptor, profileId, classId);
  
  // Send response to the popup
  res.send({
    success: true,
    message: `Download scheduled to run daily at ${scheduledTime}`
  });
};

// Function to create a pending download entry
async function createPendingDownload(classId: string, downloadTime: string) {
  try {
    const client = getSupabaseClient();
    const responseUrl = process.env.PLASMO_PUBLIC_API_URL || '';
    
    const { data, error } = await client
      .from('downloads')
      .insert({
        class: classId,
        status: 'pending',
        download_time: downloadTime,
        created_at: new Date().toISOString(),
        response_url: responseUrl
      })
      .select()
      .single();
    
    if (error) {
      console.error('[Background] Error creating pending download record:', error);
      return null;
    }
    
    console.log(`[Background] Created pending download record with ID: ${data.id} for ${downloadTime}`);
    return data.id;
  } catch (error) {
    console.error('[Background] Error creating pending download:', error);
    return null;
  }
}

// Function to set up SSO refresh alarm
async function setupSSORefreshAlarm(courseId: string, classId: string, scheduledDownloadTime: number) {
  const ssoRefreshAlarmName = `sso_refresh_${classId}`;
  const storage = new Storage();
  
  // Store SSO refresh data
  await storage.set(ssoRefreshAlarmName, {
    classId,
    courseId,
    lastRefresh: Date.now()
  });
  
  // Create alarm to refresh SSO hourly
  chrome.alarms.create(ssoRefreshAlarmName, {
    periodInMinutes: 60 // Refresh every hour
  });
  
  console.log(`[Background] Created SSO refresh alarm ${ssoRefreshAlarmName} for course ${courseId}`);
}

// Update the alarm handler to handle SSO refresh alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('download_course_')) {
    const storage = new Storage();
    const alarmData = await storage.get<DownloadAlarmData>(alarm.name);
    
    if (!alarmData) {
      console.log(`[Background] No data found for alarm ${alarm.name}, clearing alarm`);
      chrome.alarms.clear(alarm.name);
      return;
    }
    
    // Extract the class ID from the alarm name
    const classId = alarm.name.replace('download_course_', '');
    
    // Check if we should continue downloading this course
    const shouldContinue = await checkShouldContinueDownload(classId);
    
    if (!shouldContinue) {
      console.log(`[Background] Download flag is false for class ${classId}, clearing alarm`);
      chrome.alarms.clear(alarm.name);
      await storage.remove(alarm.name);
      return;
    }
    
    console.log(`[Background] Alarm triggered for ${alarm.name}, starting daily download`);
    
    // Perform the download
    await performDownload(alarmData.courseId, alarmData.courseDescriptor, alarmData.profileId, alarmData.classId);
    
    // Create a pending download entry for the next scheduled download
    const nextDownloadDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    const [hours, minutes] = alarmData.scheduledTime.split(":").map(Number);
    nextDownloadDate.setHours(hours, minutes, 0, 0);
    
    await createPendingDownload(classId, nextDownloadDate.toISOString());
  }
  else if (alarm.name.startsWith('sso_refresh_')) {
    const storage = new Storage();
    const classId = alarm.name.replace('sso_refresh_', '');
    const ssoData = await storage.get<SSORefreshAlarmData>(alarm.name);
    
    if (!ssoData) {
      console.log(`[Background] No SSO refresh data found for alarm ${alarm.name}, clearing alarm`);
      chrome.alarms.clear(alarm.name);
      return;
    }
    
    // Check if we should continue refreshing SSO for this course
    const shouldContinue = await checkShouldContinueDownload(classId);
    
    if (!shouldContinue) {
      console.log(`[Background] Download flag is false for class ${classId}, clearing SSO refresh alarm`);
      chrome.alarms.clear(alarm.name);
      await storage.remove(alarm.name);
      return;
    }
    
    console.log(`[Background] SSO refresh alarm triggered for ${alarm.name}, refreshing credentials`);
    
    // Perform the SSO refresh
    await refreshSSO(ssoData.courseId);
    
    // Update last refresh timestamp
    await storage.set(alarm.name, {
      ...ssoData,
      lastRefresh: Date.now()
    });
  }
});

// Function to refresh SSO credentials
async function refreshSSO(courseId: string) {
  try {
    console.log(`[Background] Refreshing SSO credentials for course ${courseId}`);
    
    // Create a hidden tab to refresh SSO
    const contentPageUrl = `https://purdue.brightspace.com/d2l/le/content/${courseId}/Home`;
    const tab = await chrome.tabs.create({ url: contentPageUrl, active: false });
    
    if (!tab || !tab.id) {
      throw new Error("Failed to create tab for SSO refresh");
    }
    
    // Wait for page to load
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        chrome.tabs.remove(tab.id).catch(() => {});
        reject(new Error("SSO refresh page load timeout"));
      }, 30000);
      
      const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(timeout);
          setTimeout(() => {
            chrome.tabs.remove(tab.id).catch(() => {});
            resolve(true);
          }, 5000); // Keep the page open for 5 seconds to ensure SSO is refreshed
        }
      };
      
      chrome.tabs.onUpdated.addListener(listener);
    });
    
    console.log(`[Background] Successfully refreshed SSO credentials for course ${courseId}`);
    return true;
  } catch (error) {
    console.error(`[Background] Error refreshing SSO credentials:`, error);
    return false;
  }
}

// Update the check function to use classId instead of courseId
async function checkShouldContinueDownload(classId: string): Promise<boolean> {
  try {
    // Get the class from the database
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('classes')
      .select('*')
      .eq('active', true)
      .eq('deleted', false)
      .eq('id', classId)
    
    if (error) {
      console.error('Error fetching classes:', error);
      throw new Error(error.message);
    }
    const classData = data[0];
    return classData?.download === true;
  } catch (error) {
    console.error(`[Background] Error checking download status:`, error);
    return false;
  }
}

// Update performDownload to include classId
async function performDownload(courseId: string, courseDescriptor: string, profileId: string, classId: string) {
  // Check if we should download before starting
  const shouldDownload = await checkShouldContinueDownload(classId);
  if (!shouldDownload) {
    console.log(`[Background] Download flag is false for class ${classId}, skipping download`);
    return;
  }
  
  let tab: chrome.tabs.Tab | undefined;
  let isProcessing = false;
  let downloadListener: ((downloadItem: chrome.downloads.DownloadItem) => void) | undefined;
  
  const storage = new Storage();
  const client = getSupabaseClient();
  
  try {
    // Check for existing pending download record
    const { data: pendingDownloads, error: pendingError } = await client
      .from('downloads')
      .select('*')
      .eq('class', classId)
      .eq('status', 'pending')
      .order('download_time', { ascending: true })
      .limit(1);
    
    let downloadId;
    let responseUrl = process.env.PLASMO_PUBLIC_API_URL || '';
    
    if (pendingError) {
      console.error('[Background] Error checking pending downloads:', pendingError);
    }
    
    if (pendingDownloads && pendingDownloads.length > 0) {
      // Use the existing pending download record
      downloadId = pendingDownloads[0].id;
      // Use the response_url from the pending download if available
      responseUrl = pendingDownloads[0].response_url || responseUrl;
      
      // Update the status to 'init'
      await client
        .from('downloads')
        .update({
          status: 'init',
          updated_at: new Date().toISOString()
        })
        .eq('id', downloadId);
        
      console.log(`[Background] Using pending download record with ID: ${downloadId}`);
    } else {
      // Create a new entry in the downloads table
      const { data: downloadData, error: downloadError } = await client
        .from('downloads')
        .insert({
          class: classId,
          status: 'init',
          created_at: new Date().toISOString(),
          response_url: responseUrl
        })
        .select()
        .single();
      
      if (downloadError) {
        console.error('[Background] Error creating download record:', downloadError);
        throw new Error(`Failed to create download record: ${downloadError.message}`);
      }
      
      downloadId = downloadData.id;
      console.log(`[Background] Created download record with ID: ${downloadId}`);
    }
    
    // Define the listener
    downloadListener = async (downloadItem: chrome.downloads.DownloadItem) => {
      if (downloadItem.url.includes('/downloads/Course/') && !isProcessing) {
        isProcessing = true;
        console.log("[Background] Download created:", downloadItem);
        
        try {
          // Update status
          await storage.set(`downloadStatus_${courseId}`, 'Processing download...');
          
          // Get the cookies for authentication
          const cookies = await chrome.cookies.getAll({ url: downloadItem.url });
          const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
          
          // Immediately cancel the download to prevent saving to user's device
          await chrome.downloads.cancel(downloadItem.id);
          
          // Update status
          await storage.set(`downloadStatus_${courseId}`, 'Uploading to server...');
          
          // Update download status to 'sent'
          await client
            .from('downloads')
            .update({ status: 'sent', updated_at: new Date().toISOString() })
            .eq('id', downloadId);
          
          // Fetch the file
          const response = await fetch(downloadItem.url, {
            headers: {
              'Cookie': cookieHeader
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          // Get the file data
          const blob = await response.blob();
          
          // Ensure we have a valid filename
          const filename = downloadItem.filename || 'course_content.zip';
          
          // Create FormData to send the files
          const formData = new FormData();
          formData.append('file', new File([blob], filename, { type: 'application/zip' }));
          formData.append('class_id', classId);
          formData.append('filename', filename);
          formData.append('response_url', responseUrl);
          formData.append('profile_id', profileId);
          formData.append('download_id', downloadId);
          
          console.log("[Background] Uploading file to server:", {
            filename: filename,
            courseId: courseId,
            classId: classId,
            downloadId: downloadId,
            responseUrl: responseUrl,
            size: blob.size
          });
          
          // Upload to server with progress tracking
          await storage.set(`downloadStatus_${courseId}`, 'Uploading to server...');
          await storage.set(`uploadProgress_${courseId}`, 0);

          const totalSize = blob.size;

          // Start time for upload speed calculation
          const startTime = Date.now();
          const updateInterval = 100; // Update progress every 100ms
          let lastUpdateTime = startTime;

          // Calculate estimated total upload time based on file size
          // Using heuristic that 10KB takes 5 seconds
          const bytesPerSecond = 804447
          // const estimatedTimeMs = (totalSize / bytesPerSecond) * 1000;

          // Add a debounced storage update mechanism
          let lastStorageUpdateTime = Date.now();
          let pendingProgress = 0;
          
          // Function to update storage with debouncing
          const updateStorageWithProgress = async (progress: number, status: string) => {
            pendingProgress = progress;
            const currentTime = Date.now();
            
            // Only update storage at most once per second to avoid quota limits
            if (currentTime - lastStorageUpdateTime >= 1000) {
              await storage.set(`uploadProgress_${courseId}`, pendingProgress);
              await storage.set(`downloadStatus_${courseId}`, status);
              lastStorageUpdateTime = currentTime;
              pendingProgress = 0;
            }
          };
          
          // Modify the progress update function to use debounced storage updates
          const updateProgressEstimate = async () => {
            const currentTime = Date.now();
            const elapsedMs = currentTime - startTime;
            const timeSinceLastUpdate = currentTime - lastUpdateTime;
            
            // Only update at specified intervals
            if (timeSinceLastUpdate < updateInterval) return;
            lastUpdateTime = currentTime;
            
            // Calculate estimated bytes uploaded based on elapsed time
            const estimatedBytesUploaded = (elapsedMs / 1000) * bytesPerSecond;
            
            // Calculate progress percentage (max 95% until confirmed complete)
            const estimatedProgress = Math.min(95, Math.round((estimatedBytesUploaded / totalSize) * 100));
            
            // Use the debounced update function instead of direct storage updates
            await updateStorageWithProgress(
              estimatedProgress, 
              `Uploading to server... ${estimatedProgress}%`
            );
          };

          // Start progress updates
          const progressInterval = setInterval(updateProgressEstimate, updateInterval);

          try {
            // Perform the actual upload
            const uploadResult = await fetch(`${responseUrl}/upload/content`, {
              method: 'POST',
              body: formData
            });

            // Clear the interval once upload is complete
            clearInterval(progressInterval);

            if (!uploadResult.ok) {
              throw new Error(`Upload failed: ${uploadResult.status} ${uploadResult.statusText}`);
            }

            // Update progress to 100% when complete
            await storage.set(`uploadProgress_${courseId}`, 100);
            await storage.set(`downloadStatus_${courseId}`, 'Upload complete! ✅');

            const responseData = await uploadResult.json();
            console.log('[Background] Upload successful:', responseData);
            
            // Close the tab silently
            if (tab?.id) {
              chrome.tabs.remove(tab.id).catch(() => {
                console.log("[Background] Tab already closed or not found");
              });
            }
            
            // Remove the listener after successful processing
            chrome.downloads.onCreated.removeListener(downloadListener);
            
          } catch (error) {
            // Clear the interval if there's an error
            clearInterval(progressInterval);
            console.error('[Background] Error processing download:', error);
            await storage.set(`downloadStatus_${courseId}`, `Error uploading files: ${error.message}`);
            
            // Update download status to error
            await client
              .from('downloads')
              .update({ 
                status: 'error', 
                error_message: error.message,
                updated_at: new Date().toISOString() 
              })
              .eq('id', downloadId);
            
            // Remove the listener on error
            chrome.downloads.onCreated.removeListener(downloadListener);
            
            // Clean up silently
            if (tab?.id) {
              chrome.tabs.remove(tab.id).catch(() => {});
            }
          }
        } catch (error) {
          console.error('[Background] Error processing download:', error);
          await storage.set(`downloadStatus_${courseId}`, `Error uploading files: ${error.message}`);
          
          // Update download status to error
          await client
            .from('downloads')
            .update({ 
              status: 'error', 
              error_message: error.message,
              updated_at: new Date().toISOString() 
            })
            .eq('id', downloadId);
          
          // Remove the listener on error
          chrome.downloads.onCreated.removeListener(downloadListener);
          
          // Clean up silently
          if (tab?.id) {
            chrome.tabs.remove(tab.id).catch(() => {});
          }
        }
      }
    };

    // Add the listener
    chrome.downloads.onCreated.addListener(downloadListener);

    // Update status
    await storage.set(`downloadStatus_${courseId}`, 'Creating tab for course content...');
    console.log("[Background] Creating new tab for course content...");
    
    const contentPageUrl = `https://purdue.brightspace.com/d2l/le/content/${courseId}/Home?itemIdentifier=TOC`;
    tab = await chrome.tabs.create({ url: contentPageUrl, active: false });
    
    if (!tab || !tab.id) {
      throw new Error("Failed to create tab");
    }

    console.log("[Background] Tab created:", tab.id);

    // Update status
    await storage.set(`downloadStatus_${courseId}`, 'Waiting for page load...');

    // Wait for page to load
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Page load timeout")), 30000);
      const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          console.log("[Background] Tab loaded:", tabId);
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(timeout);
          setTimeout(resolve, 2000); // Add a small delay after page load
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });

    // Update status
    await storage.set(`downloadStatus_${courseId}`, 'Looking for download button...');

    // Execute content script to find and click download button
    console.log("[Background] Executing content script...");
    const [results] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return new Promise(async (resolve) => {
          console.log("[Content] Starting download monitoring...");
          
          // Find and click download button
          const possibleButtons = [
            Array.from(document.querySelectorAll('button.d2l-button')).find(btn => {
              const hasDownloadText = btn.textContent?.trim() === 'Download';
              const hasDownloadIcon = btn.querySelector('.d2l-icon-custom');
              const hasLeftFloat = (btn as HTMLElement).style.cssText.includes('float:left');
              return hasDownloadText && hasDownloadIcon && hasLeftFloat;
            }),
            Array.from(document.querySelectorAll('button.d2l-button')).find(btn => 
              btn.textContent?.trim() === 'Download'),
            document.querySelector('button.d2l-button[id^="d2l_"][id*="_"][id*="_"]')
          ];

          const downloadButton = possibleButtons.find(btn => btn) as HTMLButtonElement;
          
          if (downloadButton) {
            console.log("[Content] Found download button, clicking...");
            downloadButton.click();
            resolve(true);
          } else {
            console.log("[Content] Download button not found");
            resolve(false);
          }
        });
      }
    });
    await storage.set(`downloadStatus_${courseId}`, 'Downloading course content...');

    console.log("[Background] Script execution complete. Results:", results);

  } catch (error) {
    console.error("[Background] Error:", error);
    await storage.set(`downloadStatus_${courseId}`, `Error: ${error.message}`);
    
    // Try to update the download status to error if we have a download ID
    try {
      const client = getSupabaseClient();
      const { data } = await client
        .from('downloads')
        .select('id')
        .eq('class', classId)
        .eq('status', 'init')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (data && data.length > 0) {
        await client
          .from('downloads')
          .update({ 
            status: 'error', 
            error_message: error.message,
            updated_at: new Date().toISOString() 
          })
          .eq('id', data[0].id);
      }
    } catch (dbError) {
      console.error("[Background] Error updating download status:", dbError);
    }
    
    if (downloadListener) {
      chrome.downloads.onCreated.removeListener(downloadListener);
    }
    if (tab?.id) {
      chrome.tabs.remove(tab.id).catch(() => {});
    }
  }
}

export default handler 