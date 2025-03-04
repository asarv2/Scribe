import type { PlasmoCSConfig } from "~node_modules/plasmo/dist/type";
import type { Course } from "./dashboardDetector";

export interface CourseHomepage {
  name: string;
  courseId: string;
  courseDescriptor: string | null;
  isHomepage: boolean;
}

// Configure the content script to run on D2L pages
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

// Enable debug logging
const DEBUG = true;

function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log("[Brightspace Homepage Detector]", ...args);
  }
}

// Extract course ID from URL
function getCourseId(): string | null {
  const url = window.location.href;
  const match = url.match(/https:\/\/purdue\.brightspace\.com\/d2l\/home\/(\d+)/);
  return match ? match[1] : null;
}

// Extract course description from page HTML
function getCourseDescription(): string | null {
  // Look for the "wl." pattern in the page HTML
  const pageHtml = document.documentElement.innerHTML;
  const match = pageHtml.match(/wl\.([\d]+\.[\w]+\.[\d]+\.[\d]+)/);
  
  if (match && match[1]) {
    const description = match[1];
    debugLog("Found course description:", description);
    return description;
  }
  
  // If not found, try another approach - look for course title
  const courseTitle = document.querySelector('.d2l-page-title');
  if (courseTitle && courseTitle.textContent) {
    const title = courseTitle.textContent.trim();
    debugLog("Using course title as fallback:", title);
    // Convert title to a format similar to the expected pattern
    return title.replace(/\s+/g, '.').replace(/[^a-zA-Z0-9.]/g, '');
  }
  
  debugLog("Could not find course description");
  return null;
}

// Extract course name from page
function getCourseName(): string | null {
  // Try banner overlay first (most reliable)
  const bannerOverlay = document.querySelector('d2l-image-banner-overlay');
  if (bannerOverlay && bannerOverlay.getAttribute('banner-title')) {
    return bannerOverlay.getAttribute('banner-title');
  }
  
  // Existing fallbacks
  const courseTitle = document.querySelector('.d2l-page-title');
  if (courseTitle && courseTitle.textContent) {
    return courseTitle.textContent.trim();
  }
  
  const navTitle = document.querySelector('.d2l-navigation-s-title-text');
  if (navTitle && navTitle.textContent) {
    return navTitle.textContent.trim();
  }
  
  const h1Title = document.querySelector('h1');
  if (h1Title && h1Title.textContent) {
    return h1Title.textContent.trim();
  }
  
  return null;
}

// Get course homepage information, checking existing courses first
function getCourseHomepageInfo(existingCourses: Course[] = []): CourseHomepage | null {
  const courseId = getCourseId();
  if (!courseId) {
    debugLog("Could not extract course ID");
    return null;
  }
  
  // Check if we already have this course in our existing courses
  const existingCourse = existingCourses.find(course => course.courseId === courseId);
  
  if (existingCourse) {
    debugLog("Found existing course info:", existingCourse);
    return {
      courseId: existingCourse.courseId,
      name: existingCourse.name,
      courseDescriptor: existingCourse.courseDescriptor || null,
      isHomepage: true
    };
  }
  
  // If not found in existing courses, scrape the page
  debugLog("Course not found in existing courses, scraping page");
  const name = getCourseName() || `Course ${courseId}`;
  const courseDescriptor = getCourseDescription();
  
  debugLog("Course homepage info:", {
    courseId,
    name,
    courseDescriptor
  });
  
  return {
    courseId,
    name,
    courseDescriptor,
    isHomepage: true
  };
}

// Check if the current URL is a valid Purdue Brightspace course homepage
function isValidHomepage(): boolean {
  const url = window.location.href;
  
  // Check if it's a course home page (7 digit course ID)
  const match = url.match(/https:\/\/purdue\.brightspace\.com\/d2l\/home\/(\d{7})/);
  if (!match && url !== "https://purdue-parent.d2l.evaluationkit.com/D2L/Dashboard") {
    console.log("Not a course homepage, url:", url);
    return false;
  }
  
  console.log("Valid homepage detected with ID:", match ? match[1] : "parent");
  return true;
}

// Store detected homepage info so we can access it when requested
let detectedHomepage: CourseHomepage | null = null;
let isDetecting = false; // Add this flag to prevent parallel detection attempts

// Function to wait for homepage info
function waitForHomepage(existingCourses: Course[] = [], timeout = 10000): Promise<CourseHomepage | null> {
  // If we already have detected homepage info, return it immediately
  if (detectedHomepage) {
    debugLog("Returning cached homepage info:", detectedHomepage);
    return Promise.resolve(detectedHomepage);
  }

  // If we're already detecting, wait for that process to complete
  if (isDetecting) {
    debugLog("Detection already in progress, waiting...");
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!isDetecting) {
          clearInterval(checkInterval);
          resolve(detectedHomepage);
        }
      }, 100);
    });
  }

  debugLog("Starting new homepage detection");
  isDetecting = true;

  // Check if we're on a valid page first
  if (!isValidHomepage()) {
    debugLog("Not on a valid homepage, returning null");
    isDetecting = false;
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkForHomepage = () => {
      const homepageInfo = getCourseHomepageInfo(existingCourses);
      
      if (homepageInfo) {
        debugLog("Found homepage info:", homepageInfo);
        detectedHomepage = homepageInfo;
        isDetecting = false;
        resolve(homepageInfo);
      } else if (Date.now() - startTime > timeout) {
        debugLog("Detection timed out");
        isDetecting = false;
        resolve(null);
      } else {
        setTimeout(checkForHomepage, 500);
      }
    };
    
    checkForHomepage();
  });
}

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debugLog("Homepage detector received message:", message);
  
  if (message.action === "getCourseHomepage" || message.action === "refreshHomepageInfo") {
    debugLog("Checking if on valid homepage");
    
    if (!isValidHomepage()) {
      debugLog("Not on a valid homepage, returning error");
      sendResponse({ 
        success: false,
        error: "Not on a valid Purdue Brightspace course homepage" 
      });
      return true;
    }
    
    // For refresh action, clear the cached homepage
    if (message.action === "refreshHomepageInfo") {
      debugLog("Clearing cached homepage info for refresh");
      detectedHomepage = null;
    }
    
    const existingCourses = message.courses || [];
    waitForHomepage(existingCourses).then(homepageInfo => {
      if (homepageInfo) {
        debugLog("Sending homepage info response:", homepageInfo);
        sendResponse({ 
          homepage: homepageInfo,
          success: true 
        });
      } else {
        debugLog("No homepage info found");
        sendResponse({ 
          success: false,
          error: "Could not extract course information from this page" 
        });
      }
    });
    return true;
  }
});

// Initialize the content script
function init() {
  debugLog("Homepage detector initialized on", window.location.href);
  
  // Only detect homepage if we're on a valid page
  if (isValidHomepage()) {
    debugLog("Valid homepage detected, starting initial detection");
    waitForHomepage().then(homepageInfo => {
      detectedHomepage = homepageInfo;
      debugLog("Initial homepage detection complete:", detectedHomepage);
    });
  } else {
    debugLog("Not on a valid homepage, skipping initial detection");
  }
}

// Initialize the content script
init();
