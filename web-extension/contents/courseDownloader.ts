import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

// Interface for download items
export interface DownloadItem {
  url: string
  filename: string
}

// Function to trigger the download button click
function clickDownloadButton(): Promise<boolean> {
  return new Promise((resolve) => {
    console.log("Attempting to find download button...");
    
    // Try multiple methods to find the button
    const possibleButtons = [
      // Try by class and text content combination
      Array.from(document.querySelectorAll('button.d2l-button')).find(btn => {
        const hasDownloadText = btn.textContent?.trim() === 'Download';
        const hasDownloadIcon = btn.querySelector('.d2l-icon-custom');
        const hasLeftFloat = (btn as HTMLElement).style.cssText.includes('float:left');
        return hasDownloadText && hasDownloadIcon && hasLeftFloat;
      }),
      // Backup: Try by class and text content only
      Array.from(document.querySelectorAll('button.d2l-button')).find(btn => 
        btn.textContent?.trim() === 'Download'),
      // Last resort: Try by ID pattern with class
      document.querySelector('button.d2l-button[id^="d2l_"][id*="_"][id*="_"]')
    ];

    // Get the first valid button
    const downloadButton = possibleButtons.find(btn => btn) as HTMLButtonElement;

    if (downloadButton) {
      console.log("Found and clicking button");
      downloadButton.click();
      resolve(true);
    } else {
      console.log("No download button found");
      resolve(false);
    }
  });
}

// Function to find all downloadable content
async function findDownloadableContent(courseId: string): Promise<boolean> {
  return await clickDownloadButton();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Course downloader received message:", message);
  
  if (message.action === "downloadCourse") {
    if (message.courseId) {
      // Ensure DOM is loaded before searching for buttons
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          findDownloadableContent(message.courseId)
            .then(success => {
              sendResponse({ success: success });
            })
            .catch(error => {
              sendResponse({ success: false, error: error.message });
            });
        });
      } else {
        findDownloadableContent(message.courseId)
          .then(success => {
            sendResponse({ success: success });
          })
          .catch(error => {
            sendResponse({ success: false, error: error.message });
          });
      }
      return true; // Will respond asynchronously
    } else {
      sendResponse({ success: false, error: "Missing course ID" });
    }
    return true;
  }
  
  return false; // Not handled
});

// Initialize the content script
const SCRIPT_ID = 'course-downloader-initialized';

function init() {
  if (document.getElementById(SCRIPT_ID)) {
    console.log("Course downloader already initialized, skipping...");
    return;
  }

  const marker = document.createElement('div');
  marker.id = SCRIPT_ID;
  marker.style.display = 'none';
  document.body.appendChild(marker);

  console.log("D2L Companion: Course downloader initialized on", window.location.href);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

console.log("Course downloader script loaded:", window.location.href); 