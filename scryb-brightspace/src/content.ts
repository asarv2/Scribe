/// <reference types="chrome"/>

// Add this near the top of your file
const DEBUG = true;

function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log("[Brightspace Extension]", ...args);
  }
}

// Check if we're on a valid Brightspace course homepage
function isValidCoursePage(): boolean {
  const url = window.location.href;
  return /https:\/\/purdue\.brightspace\.com\/d2l\/home\/\d+/.test(url);
}

// Extract course ID from URL
function getCourseId(): string | null {
  const url = window.location.href;
  
  // Try to match the course page pattern
  let match = url.match(/https:\/\/purdue\.brightspace\.com\/d2l\/home\/(\d+)/);
  
  // If not found, try the content page pattern
  if (!match) {
    match = url.match(/https:\/\/purdue\.brightspace\.com\/d2l\/le\/content\/(\d+)/);
  }
  
  return match ? match[1] : null;
}

// Extract course description from page HTML
function getCourseDescription(): string | null {
  // First check if we have a stored description for this course
  const courseId = getCourseId();
  if (courseId) {
    // Try to get from storage
    const storedKey = `course_description_${courseId}`;
    const storedDescription = localStorage.getItem(storedKey);
    
    if (storedDescription) {
      debugLog("Using stored course description:", storedDescription);
      updateDebugOverlay("Using stored course description: " + storedDescription);
      return storedDescription;
    }
  }
  
  // Look for the "wl." pattern in the page HTML
  const pageHtml = document.documentElement.innerHTML;
  const match = pageHtml.match(/wl\.([\d]+\.[\w]+\.[\d]+\.[\d]+)/);
  
  if (match && match[1]) {
    const description = match[1];
    debugLog("Found course description:", description);
    updateDebugOverlay("Found course description: " + description);
    
    // Store it for future use
    if (courseId) {
      const storedKey = `course_description_${courseId}`;
      localStorage.setItem(storedKey, description);
      debugLog("Stored course description for future use");
      updateDebugOverlay("Stored course description for future use");
    }
    
    return description;
  }
  
  // If not found, try another approach - look for course title
  const courseTitle = document.querySelector('.d2l-page-title');
  if (courseTitle && courseTitle.textContent) {
    const title = courseTitle.textContent.trim();
    debugLog("Using course title as fallback:", title);
    updateDebugOverlay("Using course title as fallback: " + title);
    // Convert title to a format similar to the expected pattern
    return title.replace(/\s+/g, '.').replace(/[^a-zA-Z0-9.]/g, '');
  }
  
  debugLog("Could not find course description");
  updateDebugOverlay("Could not find course description");
  return null;
}

// Navigate to the content page
function navigateToContentPage(courseId: string) {
  window.location.href = `https://purdue.brightspace.com/d2l/le/content/${courseId}/Home`;
}

// Find all PDF links on the page
function findPdfLinks(): Array<{title: string, url: string, fileName: string}> {
  debugLog("Looking for PDF links...");
  updateDebugOverlay("Looking for PDF links...");
  
  const pdfLinks: Array<{title: string, url: string, fileName: string}> = [];
  const courseId = getCourseId();
  const courseDescription = getCourseDescription();
  
  if (!courseId || !courseDescription) {
    debugLog("Missing course ID or description, cannot construct PDF links");
    updateDebugOverlay("Missing course ID or description, cannot construct PDF links");
    return pdfLinks;
  }
  
  // Method 1: Find links with "PDF document" in the title
  const titleLinks = Array.from(document.querySelectorAll('a[title*="PDF document"]'));
  titleLinks.forEach(link => {
    const href = (link as HTMLAnchorElement).href;
    const title = link.textContent?.trim() || "Untitled PDF";
    // Preserve spaces in the file name, just ensure it ends with .pdf
    const fileName = title.endsWith('.pdf') ? title : `${title}.pdf`;
    
    if (href) {
      // Construct the direct PDF viewer URL
      const pdfViewerUrl = constructPdfViewerUrl(courseId, courseDescription, fileName);
      pdfLinks.push({ title, url: pdfViewerUrl, fileName });
    }
  });
  
  // Method 2: Find links that end with .pdf
  const hrefLinks = Array.from(document.querySelectorAll('a[href$=".pdf"]'));
  hrefLinks.forEach(link => {
    const href = (link as HTMLAnchorElement).href;
    const title = link.textContent?.trim() || "Untitled PDF";
    // Extract filename from href
    const urlParts = href.split('/');
    const fileName = urlParts[urlParts.length - 1];
    
    if (href && !pdfLinks.some(item => item.title === title)) {
      // Construct the direct PDF viewer URL
      const pdfViewerUrl = constructPdfViewerUrl(courseId, courseDescription, fileName);
      pdfLinks.push({ title, url: pdfViewerUrl, fileName });
    }
  });
  
  // Method 3: Find links that contain PDF viewer URLs
  const viewerLinks = Array.from(document.querySelectorAll('a[href*="pdfjs-d2l-dist"]'));
  viewerLinks.forEach(link => {
    const href = (link as HTMLAnchorElement).href;
    const title = link.textContent?.trim() || "Untitled PDF";
    
    if (href && !pdfLinks.some(item => item.title === title)) {
      // Extract the file parameter from the viewer URL
      const fileParam = extractFileParam(href);
      if (fileParam) {
        const fileName = fileParam.split('/').pop() || `${title}.pdf`;
        // Use the existing URL since it's already in the correct format
        pdfLinks.push({ title, url: href, fileName });
      } else {
        // Construct a new URL if we couldn't extract the file parameter
        // Preserve spaces in the file name, just ensure it ends with .pdf
        const fileName = title.endsWith('.pdf') ? title : `${title}.pdf`;
        const pdfViewerUrl = constructPdfViewerUrl(courseId, courseDescription, fileName);
        pdfLinks.push({ title, url: pdfViewerUrl, fileName });
      }
    }
  });
  
  debugLog(`Found ${pdfLinks.length} potential PDF links`);
  updateDebugOverlay(`Found ${pdfLinks.length} potential PDF links`);
  
  return pdfLinks;
}

// Construct a PDF viewer URL in the specified format
function constructPdfViewerUrl(courseId: string, courseDescription: string, fileName: string): string {
  // URL encode the file name - this will convert spaces to %20 automatically
  const encodedFileName = encodeURIComponent(fileName);
  
  // Construct the direct content URL instead of the viewer URL
  return `https://purdue.brightspace.com/content/enforced/${courseId}-wl.${courseDescription}/${encodedFileName}`;
}

// Extract the file parameter from a PDF viewer URL
function extractFileParam(url: string): string | null {
  // For viewer URLs
  const viewerMatch = url.match(/file=%2Fcontent%2Fenforced%2F[^%]+%2F([^%&]+)/);
  if (viewerMatch) {
    return decodeURIComponent(viewerMatch[1]);
  }
  
  // For direct content URLs
  const directMatch = url.match(/\/content\/enforced\/[^\/]+\/([^?]+)/);
  if (directMatch) {
    return decodeURIComponent(directMatch[1]);
  }
  
  return null;
}

// Send results to your server
function sendResultToServer(data: any) {
  const serverUrl = "https://633e-128-210-107-85.ngrok-free.app/upload/brightspace-data";
  const courseId = getCourseId();
  
  debugLog(`Sending data to server with courseId: ${courseId}`);
  updateDebugOverlay(`Sending data to server with courseId: ${courseId}`);
  
  const payload = {
    ...data,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    courseId: courseId
  };
  
  fetch(serverUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  .then(response => response.json())
  .then(data => {
    debugLog('Success:', data);
    updateDebugOverlay('Server response: ' + JSON.stringify(data));
  })
  .catch(error => {
    debugLog('Error:', error);
    updateDebugOverlay('Error sending to server: ' + error.message);
  });
}

// Process the current page
function processCurrentPage(): { status: string, message: string, data?: any } {
  const url = window.location.href;
  const courseId = getCourseId();
  
  // Check if we're on a course page
  if (url.includes('/d2l/home/') && courseId) {
    // Get and store the course description before navigating
    const courseDescription = getCourseDescription();
    debugLog(`Found course page with ID: ${courseId}, Description: ${courseDescription}`);
    updateDebugOverlay(`Found course page with ID: ${courseId}, Description: ${courseDescription}`);
    
    // Store the course description in chrome.storage for persistence across navigation
    if (courseDescription) {
      chrome.storage.local.set({ [`course_description_${courseId}`]: courseDescription });
    }
    
    return { 
      status: "navigate", 
      message: `Found course ID: ${courseId}. Navigating to content page...` 
    };
  } 
  // Check if we're on the content page
  else if (url.includes('/d2l/le/content/') && courseId) {
    debugLog("On content page, looking for PDF links");
    updateDebugOverlay("On content page, looking for PDF links");
    
    // Try to get the stored course description from chrome.storage
    chrome.storage.local.get([`course_description_${courseId}`], (result) => {
      const storedDescription = result[`course_description_${courseId}`];
      if (storedDescription) {
        // Store it in localStorage for use by getCourseDescription
        localStorage.setItem(`course_description_${courseId}`, storedDescription);
        debugLog("Retrieved stored course description:", storedDescription);
        updateDebugOverlay("Retrieved stored course description: " + storedDescription);
      }
    });
    
    // Find PDF links
    const pdfLinks = findPdfLinks();
    
    if (pdfLinks.length > 0) {
      // Send the links to the background script for processing
      chrome.runtime.sendMessage({ 
        action: "processPdfLinks", 
        links: pdfLinks,
        courseId: courseId
      });
      
      return { 
        status: "processing", 
        message: `Found ${pdfLinks.length} PDF links. Processing...`,
        data: { pdfLinks }
      };
    } else {
      return { 
        status: "error", 
        message: "No PDF links found on this page" 
      };
    }
  } else {
    return { 
      status: "error", 
      message: "Not on a valid Brightspace page or could not extract course ID" 
    };
  }
}

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debugLog("Content script received message:", message);
  updateDebugOverlay("Received message: " + JSON.stringify(message));
  
  if (message.action === "startProcess") {
    debugLog("Starting process from popup request");
    updateDebugOverlay("Starting process from popup request");
    
    const result = processCurrentPage();
    
    if (result.status === "navigate") {
      const courseId = getCourseId();
      const courseDescription = getCourseDescription();
      
      if (courseId) {
        // Send both course ID and description to background script
        chrome.runtime.sendMessage({ 
          action: "navigateToContent", 
          courseId: courseId,
          courseDescription: courseDescription
        });
      }
    }
    
    sendResponse(result);
  } else if (message.action === "checkPage") {
    // Just check the current page without taking action
    const result = {
      url: window.location.href,
      courseId: getCourseId(),
      isContentPage: window.location.href.includes('/d2l/le/content/')
    };
    sendResponse(result);
  } else if (message.action === "findPdfLinks") {
    // Find PDF links on the current page
    const pdfLinks = findPdfLinks();
    sendResponse({ links: pdfLinks });
    return true;
  }
  
  // Return true for async responses
  return true;
});

function addDebugOverlay(): HTMLElement | null {
  if (!DEBUG) return null;
  
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.bottom = '10px';
  overlay.style.right = '10px';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  overlay.style.color = 'white';
  overlay.style.padding = '10px';
  overlay.style.borderRadius = '5px';
  overlay.style.zIndex = '9999';
  overlay.style.maxHeight = '200px';
  overlay.style.overflowY = 'auto';
  overlay.style.maxWidth = '400px';
  overlay.id = 'brightspace-extension-debug';
  
  document.body.appendChild(overlay);
  
  return overlay;
}

function updateDebugOverlay(message: string) {
  if (!DEBUG) return;
  
  let overlay = document.getElementById('brightspace-extension-debug');
  if (!overlay) {
    overlay = addDebugOverlay();
  }
  
  if (!overlay) return;
  
  const entry = document.createElement('div');
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  overlay.appendChild(entry);
  
  // Keep only the last 10 messages
  while (overlay.childNodes.length > 10) {
    const firstChild = overlay.firstChild;
    if (firstChild) {
      overlay.removeChild(firstChild);
    }
  }
}

// Initialize debug overlay
if (DEBUG) {
  window.addEventListener('load', () => {
    updateDebugOverlay("Content script loaded on: " + window.location.href);
    updateDebugOverlay("Course ID: " + getCourseId());
    updateDebugOverlay("Course Description: " + getCourseDescription());
  });
}
