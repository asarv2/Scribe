/// <reference types="chrome"/>

import { debugLog, updateDebugOverlay } from './debug';

// Define the PdfLink interface
export interface PdfLink {
  title: string;
  url: string;
  fileName: string;
}

// Check if we're on a valid Brightspace course homepage
export function isValidCoursePage(): boolean {
  const url = window.location.href;
  return /https:\/\/purdue\.brightspace\.com\/d2l\/home\/\d+/.test(url);
}

// Extract course ID from URL
export function getCourseId(): string | null {
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
export function getCourseDescription(): string | null {
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

// Find all PDF links on the assignments page
export function findAssignmentPdfLinks(): PdfLink[] {
  debugLog("Looking for PDF links in assignments...");
  updateDebugOverlay("Looking for PDF links in assignments...");
  
  const pdfLinks: PdfLink[] = [];
  const courseId = getCourseId();
  const courseDescription = getCourseDescription();
  
  if (!courseId || !courseDescription) {
    debugLog("Missing course ID or description, cannot process assignment links");
    updateDebugOverlay("Missing course ID or description, cannot process assignment links");
    return pdfLinks;
  }
  
  // Select all <a> elements whose href attribute contains ".pdf"
  const links = document.querySelectorAll<HTMLAnchorElement>('a[href*=".pdf"]');
  
  links.forEach(link => {
    const href = link.href;
    const title = link.textContent?.trim() || "Untitled Assignment PDF";
    
    // Extract filename from href
    const urlParts = href.split('/');
    const fileName = urlParts[urlParts.length - 1].split('?')[0]; // Remove query parameters
    
    if (href) {
      // For assignment PDFs, we can use the direct href as it's usually already a direct link
      pdfLinks.push({ title, url: href, fileName });
    }
  });
  
  debugLog(`Found ${pdfLinks.length} PDF links in assignments`);
  updateDebugOverlay(`Found ${pdfLinks.length} PDF links in assignments`);
  
  return pdfLinks;
}

// Find all PDF links on the page
export function findPdfLinks(): PdfLink[] {
  debugLog("Looking for PDF links...");
  updateDebugOverlay("Looking for PDF links...");
  
  const pdfLinks: PdfLink[] = [];
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
export function constructPdfViewerUrl(courseId: string, courseDescription: string, fileName: string): string {
  // URL encode the file name - this will convert spaces to %20 automatically
  const encodedFileName = encodeURIComponent(fileName);
  
  // Construct the direct content URL instead of the viewer URL
  return `https://purdue.brightspace.com/content/enforced/${courseId}-wl.${courseDescription}/${encodedFileName}`;
}

// Extract the file parameter from a PDF viewer URL
export function extractFileParam(url: string): string | null {
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

// Process the current page - updated to handle assignments page
export function processCurrentPage(): { status: string, message: string, data?: any } {
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
      // If no content links found, still navigate to assignments page
      return { 
        status: "navigating_to_assignments", 
        message: "No PDF links found on content page. Navigating to assignments page..." 
      };
    }
  }
  // Check if we're on the assignments page
  else if (url.includes('/d2l/lms/dropbox/user/folders_list.d2l') && courseId) {
    debugLog("On assignments page, looking for PDF links");
    updateDebugOverlay("On assignments page, looking for PDF links");
    
    // Find PDF links in assignments
    const assignmentPdfLinks = findAssignmentPdfLinks();
    
    if (assignmentPdfLinks.length > 0) {
      // Send the links to the background script for processing
      chrome.runtime.sendMessage({ 
        action: "processAssignmentPdfLinks", 
        links: assignmentPdfLinks,
        courseId: courseId
      });
      
      return { 
        status: "processing_assignments", 
        message: `Found ${assignmentPdfLinks.length} PDF links in assignments. Processing...`,
        data: { assignmentPdfLinks }
      };
    } else {
      return { 
        status: "complete", 
        message: "No PDF links found in assignments" 
      };
    }
  } else {
    return { 
      status: "error", 
      message: "Not on a valid Brightspace page or could not extract course ID" 
    };
  }
}