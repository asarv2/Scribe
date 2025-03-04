/// <reference types="chrome"/>
// Define the PdfLink interface
export interface PdfLink {
  title: string;
  url: string;
  fileName: string;
}

// Process PDF links - updated to handle assignment PDFs
export function processPdfLinks(links: PdfLink[], courseId: string, isAssignment: boolean = false) {
  console.log(`Processing ${links.length} PDF links for course ${courseId} (${isAssignment ? 'assignments' : 'content'})`);
  
  // Store the links and course ID
  chrome.storage.local.set({ 
    pdfLinks: links,
    courseId: courseId,
    currentLinkIndex: 0,
    processedLinks: [],
    isAssignment: isAssignment
  });
  
  // Notify popup that we found PDF links
  chrome.runtime.sendMessage({ 
    action: isAssignment ? "assignmentPdfLinksFound" : "pdfLinksFound",
    count: links.length
  });
  
  // Start processing the first link
  processNextPdfLink();
}

// Process the next PDF link in the queue
function processNextPdfLink() {
  chrome.storage.local.get(['pdfLinks', 'courseId', 'currentLinkIndex', 'processedLinks'], (data) => {
    if (!data.pdfLinks || !data.courseId || data.currentLinkIndex === undefined) {
      console.error("Missing data for processing PDF links");
      return;
    }
    
    const links = data.pdfLinks as PdfLink[];
    const index = data.currentLinkIndex as number;
    const processedLinks = data.processedLinks as Array<{title: string, url: string, status: string}> || [];
    
    // Check if we've processed all links
    if (index >= links.length) {
      console.log("All PDF links processed");
      
      // Notify popup that we're done
      chrome.runtime.sendMessage({ 
        action: "pdfProcessingComplete",
        processedLinks: processedLinks
      });
      
      return;
    }
    
    const link = links[index];
    console.log(`Processing link ${index + 1}/${links.length}: ${link.title}`);
    
    // Notify popup of progress
    chrome.runtime.sendMessage({ 
      action: "pdfProcessingProgress",
      current: index + 1,
      total: links.length,
      title: link.title
    });
    
    // Fetch and upload the PDF
    fetchAndUploadPdf(link.url, link.title, data.courseId, (success, error) => {
      console.log(`Processed ${link.title}: ${success ? 'Success' : 'Failed'}`);
      
      // Record the result
      processedLinks.push({
        title: link.title,
        url: link.url,
        status: success ? 'uploaded' : `error: ${error}`
      });
      
      // Move to the next link
      chrome.storage.local.set({ 
        currentLinkIndex: index + 1,
        processedLinks: processedLinks
      }, () => {
        // Process the next link after a short delay
        setTimeout(processNextPdfLink, 1000);
      });
    });
  });
}

// Fetch and upload a PDF file directly to the server - updated to handle assignment PDFs
function fetchAndUploadPdf(url: string, title: string, courseId: string, callback: (success: boolean, error?: string) => void) {
  console.log(`Fetching and uploading PDF: ${title} from ${url}`);
  
  // Send the URL to the popup for debugging
  chrome.runtime.sendMessage({ 
    action: "debugUrl", 
    url: url,
    title: title
  });
  
  // Create a safe filename
  const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `${courseId}_${safeTitle}.pdf`;
  
  // Check if this is an assignment PDF by looking at storage
  chrome.storage.local.get(['isAssignment'], (data) => {
    const isAssignment = data.isAssignment || false;
    
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
      formData.append('is_assignment', isAssignment.toString()); // Add flag for assignment PDFs
      
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
      callback(true);
    })
    .catch(error => {
      console.error(`Error processing PDF ${filename}:`, error);
      callback(false, error.message);
    });
  });
}

// Listen for PDF processing messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "processPdfLinks") {
    processPdfLinks(message.links, message.courseId, false);
    return true;
  }
  
  if (message.action === "processAssignmentPdfLinks") {
    processPdfLinks(message.links, message.courseId, true);
    return true;
  }
});


