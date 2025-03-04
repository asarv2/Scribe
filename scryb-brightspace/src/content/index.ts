/// <reference types="chrome"/>

import { DEBUG } from '../config';
import { 
  debugLog, 
  updateDebugOverlay, 
  addDebugOverlay 
} from './debug';
import {
  isValidCoursePage,
  getCourseId,
  getCourseDescription,
  findPdfLinks,
  findAssignmentPdfLinks,
  processCurrentPage,
  PdfLink
} from './page-parser';

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

// Navigate to the content page
function navigateToContentPage(courseId: string) {
  window.location.href = `https://purdue.brightspace.com/d2l/le/content/${courseId}/Home`;
}

// Add UI elements based on course status
function addCourseUI(courseExists: boolean) {
  // Create a button to add to the page
  const button = document.createElement('button');
  button.style.position = 'fixed';
  button.style.top = '10px';
  button.style.right = '10px';
  button.style.zIndex = '9999';
  button.style.padding = '8px 16px';
  button.style.borderRadius = '4px';
  button.style.cursor = 'pointer';
  
  if (courseExists) {
    button.textContent = 'View Course Notes';
    button.style.backgroundColor = '#4CAF50';
    button.style.color = 'white';
    button.onclick = viewCourseNotes;
  } else {
    button.textContent = 'Add to Scryb';
    button.style.backgroundColor = '#2196F3';
    button.style.color = 'white';
    button.onclick = addCourseToScryb;
  }
  
  document.body.appendChild(button);
}

// View course notes
function viewCourseNotes() {
  const courseId = getCourseId();
  if (!courseId) return;
  
  // Open a popup or navigate to your app
  window.open(`https://your-app.com/courses/${courseId}`, '_blank');
}

// Add course to Scryb
function addCourseToScryb() {
  const courseId = getCourseId();
  if (!courseId) return;
  
  // Get course title from page
  const titleElement = document.querySelector('.d2l-page-title');
  const courseTitle = titleElement ? titleElement.textContent?.trim() : 'Unknown Course';
  
  chrome.runtime.sendMessage(
    { 
      action: "addClass", 
      courseData: {
        name: courseTitle,
        course_id: courseId,
        description: `Course imported from Brightspace`
      }
    },
    (response) => {
      if (response.success) {
        debugLog('Course added successfully');
        // Update UI to reflect the course is now added
        document.querySelectorAll('button').forEach(btn => {
          if (btn.textContent === 'Add to Scryb') {
            btn.textContent = 'View Course Notes';
            btn.style.backgroundColor = '#4CAF50';
          }
        });
      } else {
        debugLog('Failed to add course:', response.error);
        alert('Failed to add course. Please try again.');
      }
    }
  );
}

// Check if this course exists in our database
function checkCourseInDatabase(courseId: string) {
  debugLog(`Found course ID: ${courseId}, checking if it exists in database`);
  
  chrome.runtime.sendMessage(
    { action: "checkCourse", courseId },
    (response) => {
      if (response.exists) {
        debugLog(`Course ${courseId} exists in database`);
        // Course exists, you can add UI elements or take other actions
        addCourseUI(true);
      } else {
        debugLog(`Course ${courseId} does not exist in database`);
        // Course doesn't exist, show different UI
        addCourseUI(false);
      }
    }
  );
}

// Run when page loads
window.addEventListener('load', () => {
  if (DEBUG) {
    updateDebugOverlay("Content script loaded on: " + window.location.href);
    updateDebugOverlay("Course ID: " + getCourseId());
    updateDebugOverlay("Course Description: " + getCourseDescription());
  }
  
  if (isValidCoursePage()) {
    const courseId = getCourseId();
    if (courseId) {
      checkCourseInDatabase(courseId);
    }
  }
});

// Listen for messages from background script
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
  } else if (message.action === "findAssignmentPdfLinks") {
    // Find PDF links on the assignments page
    const assignmentPdfLinks = findAssignmentPdfLinks();
    sendResponse({ links: assignmentPdfLinks });
  }
  
  // Return true for async responses
  return true;
});
