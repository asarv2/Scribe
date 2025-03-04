/// <reference types="chrome"/>
// Navigate to content page
export function navigateToContentPage(tabId: number, courseId: string, courseDescription?: string) {
  console.log(`Navigating to content page for course ${courseId}`);
  
  const contentUrl = `https://purdue.brightspace.com/d2l/le/content/${courseId}/Home`;
  
  // Store the course ID before navigation
  chrome.storage.local.set({ pendingCourseId: courseId });
  
  // If course description is provided, store it too
  if (courseDescription) {
    chrome.storage.local.set({ [`course_description_${courseId}`]: courseDescription });
  }
  
  // Update the tab URL
  chrome.tabs.update(tabId, { url: contentUrl });
  
  // After navigation, we need to wait for the page to load
  chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes(contentUrl)) {
      // Remove the listener to avoid multiple calls
      chrome.tabs.onUpdated.removeListener(listener);
      
      console.log("Navigation complete, looking for PDF links");
      
      // Wait a bit for the page to fully render, then send a message to the content script
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { action: "findPdfLinks" }, (response) => {
          console.log("PDF links found:", response);
          
          if (response && response.links && response.links.length > 0) {
            // Process the PDF links
            chrome.runtime.sendMessage({ 
              action: "processPdfLinks", 
              links: response.links,
              courseId: courseId
            });
          } else {
            // If no PDFs found, navigate to assignments page
            navigateToAssignmentsPage(tabId, courseId);
          }
        });
      }, 2000);
    }
  });
}

// Navigate to assignments page
export function navigateToAssignmentsPage(tabId: number, courseId: string) {
  console.log(`Navigating to assignments page for course ${courseId}`);
  
  const assignmentsUrl = `https://purdue.brightspace.com/d2l/lms/dropbox/user/folders_list.d2l?ou=${courseId}`;
  
  // Update the tab URL
  chrome.tabs.update(tabId, { url: assignmentsUrl });
  
  // After navigation, we need to wait for the page to load
  chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes(assignmentsUrl)) {
      // Remove the listener to avoid multiple calls
      chrome.tabs.onUpdated.removeListener(listener);
      
      console.log("Navigation to assignments complete, looking for PDF links");
      
      // Wait a bit for the page to fully render, then send a message to the content script
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { action: "findAssignmentPdfLinks" }, (response) => {
          console.log("Assignment PDF links found:", response);
          
          if (response && response.links && response.links.length > 0) {
            // Process the PDF links
            chrome.runtime.sendMessage({ 
              action: "processAssignmentPdfLinks", 
              links: response.links,
              courseId: courseId
            });
          } else {
            // Notify popup that no PDFs were found in assignments
            chrome.runtime.sendMessage({ 
              action: "assignmentPdfSearchComplete",
              success: false,
              error: "No PDF links found in assignments"
            });
          }
        });
      }, 2000);
    }
  });
}

// Listen for navigation messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "navigateToContent" && sender.tab && sender.tab.id) {
    navigateToContentPage(sender.tab.id, message.courseId, message.courseDescription);
    return true;
  }
  
  if (message.action === "navigateToAssignments" && sender.tab && sender.tab.id) {
    navigateToAssignmentsPage(sender.tab.id, message.courseId);
    return true;
  }
});


