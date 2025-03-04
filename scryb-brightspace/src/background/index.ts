/// <reference types="chrome"/>
import { API_URL, DEBUG } from '../config';
import { getSupabaseClient } from '../utils/supabase-client';
import { getClasses } from '../utils/queries/get-classes';

// Import other modules
import './pdf-handler';
import './navigation';

// Import handlers
import './class-handler';
import { checkCourseExists } from '../utils/queries/class-management';

// Log when extension is installed
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Extension installed.");
  
  // Test Supabase connection
  try {
    const classes = await getClasses();
    console.log("Successfully connected to Supabase. Found classes:", classes);
  } catch (error) {
    console.error("Failed to connect to Supabase:", error);
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background script received message:", message);
  
  if (message.action === "checkCourse") {
    checkCourseExists(message.courseId)
      .then(exists => {
        sendResponse({ exists });
      })
      .catch(error => {
        console.error("Error checking course:", error);
        sendResponse({ exists: false, error: error.message });
      });
    
    return true; // Keep the message channel open for async response
  }
  
  if (message.action === "detectPageType") {
    // Forward the message to the active tab's content script
    if (sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(sender.tab.id, { action: "detectPageType" }, response => {
        sendResponse(response);
      });
    }
    return true;
  }
  
  // Other message handlers are in their respective modules
  
  return true; // Keep the message channel open for async response
});
