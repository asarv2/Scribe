/// <reference types="chrome"/>
import { addClass, updateClass, deleteClass, getClassByCourseId } from '../utils/queries/class-management';

// Listen for class management messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "addClass") {
    addClass(message.courseData)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error("Error adding class:", error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep the message channel open for async response
  }
  
  if (message.action === "updateClass") {
    updateClass(message.id, message.updates)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error("Error updating class:", error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
  
  if (message.action === "deleteClass") {
    deleteClass(message.id)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error("Error deleting class:", error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
});

// Export this function to be used in other background scripts
export async function checkCourseExists(courseId: string): Promise<boolean> {
  const result = await getClassByCourseId(courseId);
  return result.success && !!result.data;
}