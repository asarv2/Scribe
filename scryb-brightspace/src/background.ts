/// <reference types="chrome"/>

chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed.");
  });
  
// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background script received message:", message);
  
  if (message.action === "navigateToContent") {
    // Handle navigation in the background script
    if (sender.tab && sender.tab.id && message.courseId) {
      const contentUrl = `https://purdue.brightspace.com/d2l/le/content/${message.courseId}/Home`;
      
      // Store the course ID before navigation
      chrome.storage.local.set({ pendingCourseId: message.courseId });
      
      // If course description is provided, store it too
      if (message.courseDescription) {
        chrome.storage.local.set({ [`course_description_${message.courseId}`]: message.courseDescription });
      }
      
      // Update the tab URL
      chrome.tabs.update(sender.tab.id, { url: contentUrl });
      
      // After navigation, we need to wait for the page to load
      chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
        if (sender.tab && sender.tab.id && tabId === sender.tab.id && changeInfo.status === 'complete' && tab.url && tab.url.includes(contentUrl)) {
          // Remove the listener to avoid multiple calls
          chrome.tabs.onUpdated.removeListener(listener);
          
          console.log("Navigation complete, looking for PDF links");
          
          // Wait a bit for the page to fully render, then send a message to the content script
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { action: "findPdfLinks" }, (response) => {
              console.log("PDF links found:", response);
              
              if (response && response.links && response.links.length > 0) {
                // Process the PDF links
                processPdfLinks(response.links, message.courseId);
              } else {
                // Notify popup that no PDFs were found
                chrome.runtime.sendMessage({ 
                  action: "pdfSearchComplete",
                  success: false,
                  error: "No PDF links found"
                });
              }
            });
          }, 2000);
        }
      });
    }
  } else if (message.action === "processPdfLinks") {
    // Process PDF links sent from content script
    processPdfLinks(message.links, message.courseId);
  }
  
  // Always return true for async responses
  return true;
});

// Process PDF links
function processPdfLinks(links: Array<{title: string, url: string, fileName: string}>, courseId: string) {
  console.log(`Processing ${links.length} PDF links for course ${courseId}`);
  
  // Store the links and course ID
  chrome.storage.local.set({ 
    pdfLinks: links,
    courseId: courseId,
    currentLinkIndex: 0,
    processedLinks: []
  });
  
  // Notify popup that we found PDF links
  chrome.runtime.sendMessage({ 
    action: "pdfLinksFound",
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
    
    const links = data.pdfLinks as Array<{title: string, url: string, fileName: string}>;
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

// Fetch and upload a PDF file directly to the server
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
    callback(true);
  })
  .catch(error => {
    console.error(`Error processing PDF ${filename}:`, error);
    callback(false, error.message);
  });
}
  