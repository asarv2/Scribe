import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

interface DownloadCourseRequest {
  courseId: string
  courseDescriptor: string
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
  const { courseId, courseDescriptor } = req.body;
  let tab: chrome.tabs.Tab | undefined;
  let syllabusTab: chrome.tabs.Tab | undefined;
  let isProcessing = false; // Add flag to prevent duplicate processing
  let downloadListener: ((downloadItem: chrome.downloads.DownloadItem) => void) | undefined;
  let syllabusFileName: string | null = null;
  let syllabusBlob: Blob | null = null;
  
  const storage = new Storage();
  
  try {
    // Define the listener
    downloadListener = async (downloadItem: chrome.downloads.DownloadItem) => {
      if (downloadItem.url.includes('/downloads/Course/') && !isProcessing) {
        isProcessing = true; // Set flag to prevent duplicate processing
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
          
          // Create FormData to send the files
          const formData = new FormData();
          formData.append('file', new File([blob], filename, { type: 'application/zip' }));
          formData.append('course_id', courseId);
          formData.append('course_descriptor', courseDescriptor);
          formData.append('filename', filename);
          
          // Add syllabus if available
          if (syllabusFileName && syllabusBlob) {
            formData.append('syllabus_file', new File([syllabusBlob], syllabusFileName));
            formData.append('syllabus_filename', syllabusFileName);
            console.log("[Background] Added syllabus to upload:", syllabusFileName);
          }
          
          console.log("[Background] Uploading file to server:", {
            filename: filename,
            courseId: courseId,
            courseDescriptor: courseDescriptor,
            size: blob.size,
            hasSyllabus: Boolean(syllabusFileName && syllabusBlob)
          });
          
          // Upload to server with progress tracking
          await storage.set('downloadStatus', 'Uploading to server...');
          await storage.set('uploadProgress', 0);

          const totalSize = blob.size + (syllabusBlob?.size || 0);

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
              await storage.set('uploadProgress', pendingProgress);
              await storage.set('downloadStatus', status);
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
            const uploadResult = await fetch(`${process.env.PLASMO_PUBLIC_API_URL}/upload/course`, {
              method: 'POST',
              body: formData
            });

            // Clear the interval once upload is complete
            clearInterval(progressInterval);

            if (!uploadResult.ok) {
              throw new Error(`Upload failed: ${uploadResult.status} ${uploadResult.statusText}`);
            }

            // Update progress to 100% when complete
            await storage.set('uploadProgress', 100);
            await storage.set('downloadStatus', 'Upload complete! ✅');

            const responseData = await uploadResult.json();
            console.log('[Background] Upload successful:', responseData);
            
            // Close the tab silently (ignore errors)
            if (tab?.id) {
              chrome.tabs.remove(tab.id).catch(() => {
                // Ignore tab closing errors
                console.log("[Background] Tab already closed or not found");
              });
            }
            
            // Remove the listener after successful processing
            chrome.downloads.onCreated.removeListener(downloadListener);
            
            // Send success response
            res.send({
              success: true,
              message: "Files uploaded successfully"
            });
            
          } catch (error) {
            // Clear the interval if there's an error
            clearInterval(progressInterval);
            console.error('[Background] Error processing download:', error);
            await storage.set('downloadStatus', `Error uploading files: ${error.message}`);
            
            // Remove the listener on error
            chrome.downloads.onCreated.removeListener(downloadListener);
            
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
        } catch (error) {
          console.error('[Background] Error processing download:', error);
          await storage.set('downloadStatus', `Error uploading files: ${error.message}`);
          
          // Remove the listener on error
          chrome.downloads.onCreated.removeListener(downloadListener);
          
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
    };

    // Add the listener
    chrome.downloads.onCreated.addListener(downloadListener);

    // Update initial status
    await storage.set('downloadStatus', 'Getting syllabus...');
    
    // First, try to get the syllabus
    const overviewPageUrl = `https://purdue.brightspace.com/d2l/le/content/${courseId}/Home?itemIdentifier=Overview`;
    console.log("[Background] Creating syllabus tab...");
    syllabusTab = await chrome.tabs.create({ url: overviewPageUrl, active: false });
    
    if (!syllabusTab || !syllabusTab.id) {
      console.warn("Failed to create syllabus tab, continuing without syllabus");
    } else {
      console.log("[Background] Syllabus tab created:", syllabusTab.id);
      
      // Wait for syllabus page to load
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.warn("Syllabus page load timeout, continuing without syllabus");
          resolve(null);
        }, 30000);
        
        const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
          if (tabId === syllabusTab.id && changeInfo.status === 'complete') {
            console.log("[Background] Syllabus tab loaded:", tabId);
            chrome.tabs.onUpdated.removeListener(listener);
            clearTimeout(timeout);
            setTimeout(resolve, 2000); // Add a small delay after page load
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });

      // Execute content script to find syllabus iframe
      if (syllabusTab.id) {
        try {
          const [syllabusResults] = await chrome.scripting.executeScript({
            target: { tabId: syllabusTab.id },
            func: () => {
              const iframe = document.querySelector('iframe.d2l-fileviewer-rendered-pdf') as HTMLIFrameElement;
              if (!iframe) return null;
              
              const title = iframe.getAttribute('title');
              if (!title) return null;
              
              // Get the src URL to extract file information if needed
              const src = iframe.getAttribute('src');
              
              return { title, src };
            }
          });

          console.log("[Background] Syllabus detection results:", syllabusResults);
          
          if (syllabusResults?.result?.title) {
            syllabusFileName = syllabusResults.result.title;
            
            // Try to download the syllabus
            await storage.set('downloadStatus', 'Downloading syllabus...');
            
            // Get cookies for authentication
            const cookies = await chrome.cookies.getAll({ url: `https://purdue.brightspace.com` });
            const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
            
            // Construct the syllabus URL
            const syllabusUrl = `https://purdue.brightspace.com/content/enforced/${courseId}-wl.${courseDescriptor}/${encodeURIComponent(syllabusFileName)}`;
            console.log("[Background] Attempting to download syllabus from:", syllabusUrl);
            
            // Fetch the syllabus
            const syllabusResponse = await fetch(syllabusUrl, {
              headers: {
                'Cookie': cookieHeader
              }
            });

            if (syllabusResponse.ok) {
              syllabusBlob = await syllabusResponse.blob();
              console.log("[Background] Syllabus downloaded successfully:", {
                fileName: syllabusFileName,
                size: syllabusBlob.size
              });
            } else {
              console.warn("[Background] Failed to download syllabus:", syllabusResponse.status, syllabusResponse.statusText);
            }
          }
        } catch (error) {
          console.warn("[Background] Error getting syllabus:", error);
        }
        
        // Close the syllabus tab
        chrome.tabs.remove(syllabusTab.id).catch(() => {
          // Ignore tab closing errors
        });
      }
    }

    // Update status
    await storage.set('downloadStatus', 'Creating tab for course content...');
    console.log("[Background] Creating new tab for course content...");
    
    const contentPageUrl = `https://purdue.brightspace.com/d2l/le/content/${courseId}/Home?itemIdentifier=TOC`;
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
    await storage.set('downloadStatus', 'Downloading course content...');

    console.log("[Background] Script execution complete. Results:", results);

  } catch (error) {
    console.error("[Background] Error:", error);
    await storage.set('downloadStatus', `Error: ${error.message}`);
    
    // Now downloadListener will be in scope
    if (downloadListener) {
      chrome.downloads.onCreated.removeListener(downloadListener);
    }
    if (tab?.id) {
      chrome.tabs.remove(tab.id).catch(() => {
        // Ignore tab closing errors
      });
    }
    
    // Make sure to close the syllabus tab if it exists
    if (syllabusTab?.id) {
      chrome.tabs.remove(syllabusTab.id).catch(() => {
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