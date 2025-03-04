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
  downloads?: DownloadItem[]
  error?: string
}

const handler: PlasmoMessaging.MessageHandler<DownloadCourseRequest, DownloadCourseResponse> = async (req, res) => {
  const { courseId } = req.body;
  let tab: chrome.tabs.Tab | undefined;
  
  const storage = new Storage();
  
  try {
    // Update status
    await storage.set('downloadStatus', 'Creating tab...');
    
    const contentPageUrl = `https://purdue.brightspace.com/d2l/le/content/${courseId}/Home`;
    tab = await chrome.tabs.create({ url: contentPageUrl, active: false });
    
    if (!tab || !tab.id) {
      throw new Error("Failed to create tab");
    }

    // Update status
    await storage.set('downloadStatus', 'Waiting for page load...');

    // Wait for page to load
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Page load timeout")), 30000);
      const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(timeout);
          setTimeout(resolve, 2000);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });

    // Update status
    await storage.set('downloadStatus', 'Looking for download button...');

    // Execute content script
    const [results] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return new Promise((resolve) => {
          console.log("Starting download detection...");
          
          // Save initial HTML state
          const initialHTML = document.documentElement.outerHTML;
          console.log("Initial page HTML:", initialHTML);

          // Track HTML changes
          let lastHTML = initialHTML;
          const debugObserver = new MutationObserver(() => {
            const currentHTML = document.documentElement.outerHTML;
            if (currentHTML !== lastHTML) {
              console.log("Page HTML changed:", currentHTML);
              lastHTML = currentHTML;
            }
          });

          debugObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true
          });

          // Listen for network requests
          const originalXHR = window.XMLHttpRequest.prototype.open;
          window.XMLHttpRequest.prototype.open = function(...args) {
            console.log("XHR Request:", args);
            return originalXHR.apply(this, args);
          };

          // Listen for fetch requests
          const originalFetch = window.fetch;
          window.fetch = function(...args) {
            console.log("Fetch Request:", args);
            return originalFetch.apply(this, args);
          };

          // Create a MutationObserver to watch for the download link
          const observer = new MutationObserver((mutations) => {
            console.log("Mutation observed:", mutations);
            
            // Look for any anchors that might be download related
            const allAnchors = document.querySelectorAll('a');
            console.log("All anchors on page:", Array.from(allAnchors).map(a => ({
              href: a.href,
              download: a.download,
              text: a.textContent,
              attributes: Array.from(a.attributes).map(attr => `${attr.name}="${attr.value}"`)
            })));

            for (const mutation of mutations) {
              const downloadLink = document.querySelector('a[download][href*="/d2l/le/content/"]');
              if (downloadLink) {
                console.log("Found download link:", downloadLink);
                observer.disconnect();
                debugObserver.disconnect();
                const url = (downloadLink as HTMLAnchorElement).href;
                const filename = (downloadLink as HTMLAnchorElement).download;
                resolve({ url, filename });
                return;
              }
            }
          });

          // Start observing with broader scope
          observer.observe(document, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
          });

          // Find and click download button
          const possibleButtons = [
            Array.from(document.querySelectorAll('button.d2l-button')).find(btn => {
              const hasDownloadText = btn.textContent?.trim() === 'Download';
              const hasDownloadIcon = btn.querySelector('.d2l-icon-custom');
              const hasLeftFloat = (btn as HTMLElement).style.cssText.includes('float:left');
              console.log("Checking button:", {
                text: btn?.textContent?.trim(),
                hasIcon: !!btn?.querySelector('.d2l-icon-custom'),
                style: btn?.getAttribute('style'),
                matches: hasDownloadText && hasDownloadIcon && hasLeftFloat
              });
              return hasDownloadText && hasDownloadIcon && hasLeftFloat;
            }),
            Array.from(document.querySelectorAll('button.d2l-button')).find(btn => 
              btn.textContent?.trim() === 'Download'),
            document.querySelector('button.d2l-button[id^="d2l_"][id*="_"][id*="_"]')
          ];

          console.log("Found possible buttons:", possibleButtons.map(btn => ({
            id: btn?.id,
            text: btn?.textContent?.trim(),
            class: btn?.className,
            style: btn?.getAttribute('style'),
            html: btn?.outerHTML
          })));

          const downloadButton = possibleButtons.find(btn => btn) as HTMLButtonElement;
          
          if (downloadButton) {
            console.log("Found and clicking button:", {
              id: downloadButton.id,
              text: downloadButton.textContent?.trim(),
              class: downloadButton.className,
              style: downloadButton.getAttribute('style'),
              html: downloadButton.outerHTML
            });
            
            // Try both click methods
            downloadButton.click();
            downloadButton.dispatchEvent(new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            }));
            
            console.log("Button clicked");
          } else {
            console.log("No download button found");
            // Save HTML for debugging
            console.log("Full page HTML at failure:", document.documentElement.outerHTML);
            resolve(null);
          }

          // Set timeout
          setTimeout(() => {
            console.log("Timeout reached. Final page HTML:", document.documentElement.outerHTML);
            observer.disconnect();
            debugObserver.disconnect();
            resolve(null);
          }, 10000);
        });
      }
    });

    console.log("Script execution complete. Results:", results);

    // Update status
    await storage.set('downloadStatus', 'Processing download...');

    if (!results.result) {
      throw new Error("No download link found");
    }

    // Close the tab. Not doing temporarily to debug
    // if (tab.id) {
    //   await chrome.tabs.remove(tab.id);
    // }

    // Update status
    await storage.set('downloadStatus', 'Starting download...');

    // Process download
    const downloadId = await chrome.downloads.download({
      url: (results.result as DownloadItem).url,
      filename: `D2L Downloads/${courseId}/${(results.result as DownloadItem).filename}`,
      saveAs: false
    });

    // Wait for download to complete
    await new Promise((resolve, reject) => {
      chrome.downloads.onChanged.addListener(function listener(delta) {
        if (delta.id === downloadId) {
          if (delta.state?.current === 'complete') {
            chrome.downloads.onChanged.removeListener(listener);
            resolve(undefined);
          } else if (delta.error) {
            chrome.downloads.onChanged.removeListener(listener);
            reject(new Error(`Download failed: ${delta.error.current}`));
          }
        }
      });
    });

    // Update status
    await storage.set('downloadStatus', 'Download complete!');

    res.send({
      success: true,
      downloads: [results.result as DownloadItem]
    });

  } catch (error) {
    console.error("Error downloading course content:", error);
    await storage.set('downloadStatus', `Error: ${error.message}`);
    // if (tab?.id) {
    //   try {
    //     await chrome.tabs.remove(tab.id);
    //   } catch (e) {
    //     console.error("Error closing tab:", e);
    //   }
    // }
    res.send({
      success: false,
      error: error.message
    });
  }
}

export default handler 