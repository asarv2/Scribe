import type { PlasmoCSConfig } from "~node_modules/plasmo/dist/type";

export interface Course {
    name: string;
    courseId: string;
    courseDescriptor: string;
}

// Configure the content script to run on D2L pages
export const config: PlasmoCSConfig = {
  matches: ["https://purdue.brightspace.com/d2l/home/*"],
  all_frames: true
}

// Store detected courses so we can access them when requested
let detectedCourses: Course[] = []

// Check if the current URL is a valid Purdue Brightspace course page
function isValidCoursePage(): boolean {
  const url = window.location.href;
  
  // Check if it's a course home page
  const homeMatch = url.match(/https?:\/\/purdue\.brightspace\.com\/d2l\/home\/(\d+)/);
  if (!homeMatch && url !== "https://purdue-parent.d2l.evaluationkit.com/D2L/Dashboard") {
    console.log("Not a course home page, url:", url);
    return false;
  }
  
  // Check if the course ID is valid (4-6 digits)
  const courseId = homeMatch[1];
  if (courseId.length < 4 || courseId.length > 6) {
    console.log("Invalid course ID length:", courseId);
    return false;
  }
  
  console.log("Valid course page detected with ID:", courseId);
  return true;
}

// Simplified function to find all d2l-card elements, including those in shadow DOM
function findAllCards(): Element[] {
  console.log("Finding all d2l-card elements...");
  
  // First, get all cards in the regular DOM
  const regularCards = Array.from(document.querySelectorAll('d2l-card[href*="/d2l/home/"]'));
  console.log(`Found ${regularCards.length} d2l-card elements in regular DOM`);
  
  // Then search shadow DOM
  const shadowCards = searchAllShadowRoots(document.documentElement, 'd2l-card[href*="/d2l/home/"]');
  console.log(`Found ${shadowCards.length} d2l-card elements in shadow DOM`);
  
  return [...regularCards, ...shadowCards];
}

// Improved recursive shadow DOM search function
function searchAllShadowRoots(root: Element | Document | DocumentFragment, selector: string): Element[] {
  let results: Element[] = [];
  
  // Get all elements that might have shadow roots
  const allElements = root.querySelectorAll('*');
  
  for (const el of allElements) {
    // Try to access shadow root
    if (el.shadowRoot) {
      // Search for the selector in this shadow root
      const found = el.shadowRoot.querySelectorAll(selector);
      if (found.length > 0) {
        results.push(...Array.from(found));
      }
      
      // Recursively search deeper shadow roots
      results.push(...searchAllShadowRoots(el.shadowRoot, selector));
    }
  }
  
  return results;
}

// Updated course extraction function with validation
function extractCourses(): Course[] {
  console.log("Extracting courses...");
  
  // Check if we're on a valid page first
  if (!isValidCoursePage()) {
    console.log("Not on a valid course page, skipping extraction");
    return [];
  }
  
  // Find all d2l-card elements
  const cards = findAllCards();
  console.log(`Processing ${cards.length} d2l-card elements`);
  
  const courses: Course[] = [];
  const processedIds = new Set<string>(); // To avoid duplicates
  
  cards.forEach((card, index) => {
    try {
      console.log(`Processing card ${index}:`, card.tagName);
      
      // Get href attribute
      const href = card.getAttribute('href');
      if (!href || !href.includes('/d2l/home/')) {
        return;
      }
      
      // Extract course ID
      const match = href.match(/\/d2l\/home\/(\d+)/);
      if (!match) return;
      
      const courseId = match[1];
      
      // Skip if we've already processed this course
      if (processedIds.has(courseId)) return;
      
      // Get course name from text attribute or content
      let fullText = card.getAttribute('text') || '';
      if (!fullText && card.textContent) {
        fullText = card.textContent.trim();
      }
      
      // Parse the full text to extract name and descriptor
      let name = fullText;
      let courseDescriptor = '';
      
      // Extract name (everything up to the first comma)
      if (fullText.includes(',')) {
        name = fullText.split(',')[0].trim();
        
        // Extract course descriptor (after "wl.")
        const wlMatch = fullText.match(/wl\.([^,]+)/i);
        if (wlMatch && wlMatch[1]) {
          courseDescriptor = wlMatch[1].trim();
        }
      }
      
      // Only add course if we found a descriptor
      if (!courseDescriptor) {
        console.log(`Skipping course ${courseId} - no descriptor found`);
        return;
      }
      
      // Add to courses array
      courses.push({
        courseId,
        name: name || `Course ${courseId}`,
        courseDescriptor: courseDescriptor
      });
      
      processedIds.add(courseId); // Add to processed IDs after successful extraction
      
      console.log(`Found course: ${name} (${courseId}) - Descriptor: ${courseDescriptor}`);
    } catch (e) {
      console.error(`Error processing card ${index}:`, e);
    }
  });
  
  console.log(`Extracted ${courses.length} courses:`, courses);
  return courses;
}

// Simplified function to wait for courses
function waitForCourses(timeout = 10000): Promise<Course[]> {
  console.log("Waiting for courses to be available");
  
  // Check if we're on a valid page first
  if (!isValidCoursePage()) {
    console.log("Not on a valid course page, returning empty array");
    return Promise.resolve([]);
  }
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkForCourses = () => {
      const courses = extractCourses();
      
      if (courses.length > 0 || (Date.now() - startTime > timeout)) {
        console.log(`Resolved with ${courses.length} courses after ${Date.now() - startTime}ms`);
        resolve(courses);
      } else {
        console.log("No courses found yet, retrying...");
        setTimeout(checkForCourses, 500);
      }
    };
    
    // Start checking
    checkForCourses();
  });
}

// Function to initialize the content script
function init() {
  console.log("D2L Companion: Course detector initialized on", window.location.href);
  
  // Only detect courses if we're on a valid page
  if (isValidCoursePage()) {
    console.log("Valid course page detected, waiting for courses");
    waitForCourses().then(courses => {
      detectedCourses = courses;
      console.log("Initial course detection complete:", detectedCourses);
    });
  } else {
    console.log("Not on a valid course page, skipping initial detection");
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Course detector received message:", message);
  
  if (message.action === "getCourses") {
    console.log("D2L Companion: Checking if on valid course page");
    
    if (!isValidCoursePage()) {
      console.log("Not on a valid course page, returning empty array");
      sendResponse({ courses: [], error: "Not on a valid Purdue Brightspace course page" });
      return true;
    }
    
    console.log("D2L Companion: Sending detected courses to popup");
    sendResponse({ courses: detectedCourses });
    return true; // Required for async response
  }
  
  if (message.action === "refreshCourses") {
    console.log("D2L Companion: Refreshing course detection");
    
    if (!isValidCoursePage()) {
      console.log("Not on a valid course page, returning empty array");
      sendResponse({ courses: [], error: "Not on a valid Purdue Brightspace course page" });
      return true;
    }
    
    waitForCourses().then(courses => {
      detectedCourses = courses;
      sendResponse({ courses: detectedCourses });
    });
    return true; // Required for async response
  }
  
  if (message.action === "dumpPageInfo") {
    console.log("D2L Companion: Dumping page info");
    // Log all d2l-card elements, including those in shadow DOM
    const cards = findAllCards();
    console.log(`Found ${cards.length} d2l-card elements (including shadow DOM)`);
    cards.forEach((card, index) => {
      console.log(`Card ${index}:`, {
        href: card.getAttribute('href'),
        text: card.getAttribute('text'),
        textContent: card.textContent?.trim()
      });
    });
    sendResponse({ success: true });
    return true;
  }
});

// Initialize the content script
init();
