import type { PlasmoCSConfig } from "~node_modules/plasmo/dist/type";
import { Storage } from "@plasmohq/storage"
import { sendToBackground } from "@plasmohq/messaging"

// Configure the content script to run on D2L pages
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

// Initialize storage
const storage = new Storage()

// Interface for PDF links
export interface PdfLink {
  title: string;
  url: string;
  fileName: string;
}

// Store detected PDF links so we can access them when requested
let detectedPdfLinks: PdfLink[] = [];

// Modify the findPdfLinks function to wait for content
async function findPdfLinks(courseId: string, courseDescriptor: string): Promise<PdfLink[]> {
  console.log(`Looking for PDF links for course ${courseId} with descriptor ${courseDescriptor}...`);
  
  const pdfLinks: PdfLink[] = [];
  
  if (!courseId || !courseDescriptor) {
    console.log("Missing course ID or descriptor, cannot construct PDF links");
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
      const pdfViewerUrl = constructPdfViewerUrl(courseId, courseDescriptor, fileName);
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
      const pdfViewerUrl = constructPdfViewerUrl(courseId, courseDescriptor, fileName);
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
        const pdfViewerUrl = constructPdfViewerUrl(courseId, courseDescriptor, fileName);
        pdfLinks.push({ title, url: pdfViewerUrl, fileName });
      }
    }
  });
  
  console.log(`Found ${pdfLinks.length} potential PDF links`);
  return pdfLinks;
}

// Construct a PDF viewer URL in the specified format
function constructPdfViewerUrl(courseId: string, courseDescriptor: string, fileName: string): string {
  // URL encode the file name - this will convert spaces to %20 automatically
  const encodedFileName = encodeURIComponent(fileName);
  
  // Construct the direct content URL instead of the viewer URL
  return `https://purdue.brightspace.com/content/enforced/${courseId}-wl.${courseDescriptor}/${encodedFileName}`;
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

// Function to download a PDF
function downloadPdf(url: string, fileName: string): Promise<{success: boolean, message: string}> {
  return new Promise((resolve) => {
    console.log("Downloading PDF from URL:", url);
    
    // Create a temporary link element to trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'document.pdf';
    a.target = '_blank';
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    resolve({ success: true, message: "Download initiated" });
  });
}

// Function to upload a PDF to the server
function uploadPdf(url: string, title: string, courseId: string): Promise<{success: boolean, message: string}> {
  console.log(`Uploading PDF: ${title} from ${url}`);
  
  // Create a safe filename
  const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `${courseId}_${safeTitle}.pdf`;
  
  return new Promise((resolve, reject) => {
    // Fetch the PDF with proper credentials
    fetch(url, {
      method: 'GET',
      credentials: 'include', // This ensures cookies are sent with the request
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }
      return response.blob();
    })
    .then(blob => {
      // Create FormData for upload
      const formData = new FormData();
      formData.append('file', blob, filename);
      formData.append('course_id', courseId);
      formData.append('title', title);
      formData.append('url', url); // Include the original URL
      
      // Upload to server
      return fetch('https://633e-128-210-107-85.ngrok-free.app/upload/course', {
        method: 'POST',
        body: formData
      });
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to upload PDF: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      console.log(`PDF uploaded successfully: ${filename}`, data);
      resolve({ success: true, message: "Upload successful" });
    })
    .catch(error => {
      console.error(`Error processing PDF ${filename}:`, error);
      resolve({ success: false, message: error.message });
    });
  });
}

// Modify the scanContentPage function
async function scanContentPage(courseId: string, courseDescriptor: string): Promise<PdfLink[]> {
  console.log(`Scanning content page for course ${courseId}...`);
  
  try {
    // First try to find links directly on the page
    const directLinks = await findPdfLinks(courseId, courseDescriptor);
    if (directLinks.length > 0) {
      return directLinks;
    }

    // If no direct links found, try background scan
    const response = await sendToBackground<
      { courseId: string; courseDescriptor: string },
      { success: boolean; pdfLinks?: PdfLink[]; error?: string }
    >({
      name: "scan-content",
      body: {
        courseId,
        courseDescriptor
      }
    });

    console.log("Received response from background:", response);

    if (!response.success) {
      throw new Error(response.error || "Failed to scan content page");
    }

    if (!response.pdfLinks?.length) {
      throw new Error("No PDF links found on this page");
    }

    return response.pdfLinks;
  } catch (error) {
    console.error("Error scanning content page:", error);
    throw error;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content downloader received message:", message);
  
  if (message.action === "getPdfLinks") {
    if (message.courseId && message.courseDescriptor) {
      findPdfLinks(message.courseId, message.courseDescriptor)
        .then(links => {
          detectedPdfLinks = links;
          storage.set("lastCourseId", message.courseId);
          sendResponse({ pdfLinks: links });
        });
      return true; // Will respond asynchronously
    }
  }
  
  if (message.action === "refreshPdfLinks") {
    if (message.courseId && message.courseDescriptor) {
      console.log("Refreshing PDF links for course:", message.courseId);
      findPdfLinks(message.courseId, message.courseDescriptor)
        .then(links => {
          detectedPdfLinks = links;
          storage.set("lastCourseId", message.courseId);
          sendResponse({ pdfLinks: links });
        })
        .catch(error => {
          sendResponse({ pdfLinks: [], error: error.message });
        });
      return true; // Will respond asynchronously
    } else {
      sendResponse({ pdfLinks: [], error: "Missing course ID or descriptor" });
    }
    return true;
  }
  
  if (message.action === "downloadPdf") {
    if (message.url && message.fileName) {
      downloadPdf(message.url, message.fileName)
        .then(result => sendResponse(result));
      return true;
    } else {
      sendResponse({ success: false, message: "Missing URL or file name" });
    }
    return true;
  }
  
  if (message.action === "uploadPdf") {
    if (message.url && message.title && message.courseId) {
      uploadPdf(message.url, message.title, message.courseId)
        .then(result => sendResponse(result));
      return true;
    } else {
      sendResponse({ success: false, message: "Missing URL, title, or course ID" });
    }
    return true;
  }
  
  if (message.action === "uploadAllPdfs") {
    if (message.courseId) {
      console.log(`Starting upload of all ${detectedPdfLinks.length} PDFs for course ${message.courseId}`);
      
      // Send initial response
      sendResponse({ 
        status: "started", 
        message: `Starting upload of ${detectedPdfLinks.length} PDFs` 
      });
      
      // Process PDFs one by one
      let processed = 0;
      let successful = 0;
      
      const processNext = (index) => {
        if (index >= detectedPdfLinks.length) {
          // All done
          chrome.runtime.sendMessage({
            action: "pdfUploadComplete",
            total: detectedPdfLinks.length,
            successful: successful
          });
          return;
        }
        
        const link = detectedPdfLinks[index];
        
        // Update progress
        chrome.runtime.sendMessage({
          action: "pdfUploadProgress",
          current: index + 1,
          total: detectedPdfLinks.length,
          title: link.title
        });
        
        // Upload the PDF
        uploadPdf(link.url, link.title, message.courseId)
          .then(result => {
            processed++;
            if (result.success) successful++;
            
            // Process the next one after a short delay
            setTimeout(() => processNext(index + 1), 1000);
          });
      };
      
      // Start processing
      processNext(0);
      
      return true;
    } else {
      sendResponse({ success: false, message: "Missing course ID" });
    }
    return true;
  }
  
  if (message.action === "scanContentPage") {
    if (message.courseId && message.courseDescriptor) {
      console.log("Scanning content page for course:", message.courseId);
      
      scanContentPage(message.courseId, message.courseDescriptor)
        .then(links => {
          console.log("Scan complete, found links:", links);
          sendResponse({ success: true, pdfLinks: links });
        })
        .catch(error => {
          console.error("Scan failed:", error);
          sendResponse({ success: false, error: error.message });
        });
      
      return true; // Will respond asynchronously
    }
  }
  
  return false; // Not handled
});

// Add this at the top of the file
const SCRIPT_ID = 'link-extractor-initialized';

// Modify the init function
function init() {
  // Check if script is already initialized
  if (document.getElementById(SCRIPT_ID)) {
    console.log("Link extractor already initialized, skipping...");
    return;
  }

  // Mark as initialized
  const marker = document.createElement('div');
  marker.id = SCRIPT_ID;
  marker.style.display = 'none';
  document.body.appendChild(marker);

  console.log("D2L Companion: Content downloader initialized on", window.location.href);
}

// Run the initialization when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Add this to verify the content script is loaded
console.log("Content script loaded:", window.location.href);
