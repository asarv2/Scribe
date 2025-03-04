import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

interface DownloadCourseRequest {
  courseId: string
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

const handler: PlasmoMessaging.MessageHandler<DownloadCourseRequest, DownloadCourseResponse> = async (req, res) => {
  const { courseId } = req.body;
  let tab: chrome.tabs.Tab | undefined;
  let downloadListener: any;
  
  const storage = new Storage();
  
  try {
    // Add downloads listener before creating tab
    chrome.downloads.onCreated.addListener(async (downloadItem) => {
      if (downloadItem.url.includes('/downloads/Course/')) {
        console.log("[Background] Download created:", downloadItem);
        
        try {
          // Update status
          await storage.set('downloadStatus', 'Processing download...');
          
          // Get the cookies for authentication
          const cookies = await chrome.cookies.getAll({ url: downloadItem.url });
          const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
          
          // Immediately cancel the download to prevent saving to user's device
          await chrome.downloads.cancel(downloadItem.id);
          
          // Update status
          await storage.set('downloadStatus', 'Uploading to server...');
          
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
          
          // Create FormData to send the file
          const formData = new FormData();
          formData.append('file', new File([blob], filename, { type: 'application/zip' }));
          formData.append('course_id', courseId);
          formData.append('filename', filename);
          
          console.log("[Background] Uploading file to server:", {
            filename: filename,
            courseId: courseId,
            size: blob.size,
            formData: Object.fromEntries(formData.entries())
          });
          
          // Upload to server
          const uploadResponse = await fetch(`${process.env.PLASMO_PUBLIC_API_URL}/upload/zip`, {
            method: 'POST',
            body: formData
          });

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('[Background] Upload response:', {
              status: uploadResponse.status,
              statusText: uploadResponse.statusText,
              body: errorText
            });
            throw new Error(`Upload failed: ${errorText}`);
          }
          
          // Upload successful
          const result = await uploadResponse.json();
          console.log('[Background] Upload successful:', result);
          
          // Update status before closing tab
          await storage.set('downloadStatus', 'Upload complete! ✅');
          
          // Close the tab silently (ignore errors)
          if (tab?.id) {
            chrome.tabs.remove(tab.id).catch(() => {
              // Ignore tab closing errors
              console.log("[Background] Tab already closed or not found");
            });
          }
          
          // Send success response
          res.send({
            success: true,
            message: "File uploaded successfully"
          });
          
        } catch (error) {
          console.error('[Background] Error processing download:', error);
          await storage.set('downloadStatus', `Error uploading file: ${error.message}`);
          
          // Send error response
          res.send({
            success: false,
            error: error.message
          });
          
          // Clean up silently
          if (tab?.id) {
            chrome.tabs.remove(tab.id).catch(() => {
              // Ignore tab closing errors
            });
          }
        }
      }
    });

    // Update initial status
    await storage.set('downloadStatus', 'Creating tab...');
    console.log("[Background] Creating new tab...");
    
    const contentPageUrl = `https://purdue.brightspace.com/d2l/le/content/${courseId}/Home`;
    tab = await chrome.tabs.create({ url: contentPageUrl, active: false });
    
    if (!tab || !tab.id) {
      throw new Error("Failed to create tab");
    }

    console.log("[Background] Tab created:", tab.id);

    // Update status
    await storage.set('downloadStatus', 'Waiting for page load...');

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
    await storage.set('downloadStatus', 'Looking for download button...');

    // Execute content script to monitor the download variable
    console.log("[Background] Executing content script...");
    const [results] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return new Promise(async (resolve) => {
          console.log("[Content] Starting download monitoring...");
          
          // Monitor network requests
          const originalXHR = window.XMLHttpRequest.prototype.open;
          window.XMLHttpRequest.prototype.open = function(...args) {
            console.log("[Content] XHR Request:", args);
            if (args[1]?.includes('InitiateCourseDownload')) {
              console.log("[Content] Download initiation detected");
            }
            return originalXHR.apply(this, args);
          };

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

    console.log("[Background] Script execution complete. Results:", results);

  } catch (error) {
    console.error("[Background] Error:", error);
    await storage.set('downloadStatus', `Error: ${error.message}`);
    
    // Clean up silently
    if (downloadListener) {
      chrome.webRequest.onBeforeRequest.removeListener(downloadListener);
    }
    if (tab?.id) {
      chrome.tabs.remove(tab.id).catch(() => {
        // Ignore tab closing errors
      });
    }
    
    res.send({
      success: false,
      error: error.message
    });
  }
};

export default handler 