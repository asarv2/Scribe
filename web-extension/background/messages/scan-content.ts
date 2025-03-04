import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import type { PdfLink } from "~contents/linkExtractor"

// Initialize storage
const storage = new Storage()

interface ScanContentRequest {
  courseId: string
  courseDescriptor: string
}

interface ScanContentResponse {
  success: boolean
  pdfLinks?: PdfLink[]
  error?: string
}

const handler: PlasmoMessaging.MessageHandler<ScanContentRequest, ScanContentResponse> = async (req, res) => {
  const { courseId, courseDescriptor } = req.body;
  let tab: chrome.tabs.Tab | undefined;
  
  // Check scanning status using Plasmo storage
  const isScanning = await storage.get('isScanning');
  if (isScanning) {
    res.send({
      success: false,
      error: "Scan already in progress"
    });
    return;
  }
  
  await storage.set('isScanning', true);
  await storage.set('currentScanResults', []); // Reset scan results
  
  try {
    const contentPageUrl = `https://purdue.brightspace.com/d2l/le/content/${courseId}/Home`;
    
    // Create a new tab
    tab = await chrome.tabs.create({ url: contentPageUrl, active: false });
    
    if (!tab || !tab.id) {
      throw new Error("Failed to create tab");
    }

    // Wait for page to fully load with a timeout
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Page load timeout"));
      }, 30000); // 30 second timeout

      const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(timeout);
          
          // Add additional delay to ensure dynamic content loads
          setTimeout(resolve, 2000);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });

    // Execute content script to find PDF links
    const [results] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (courseId: string, courseDescriptor: string) => {
        // Helper function to construct PDF viewer URL
        const constructPdfViewerUrl = (fileName: string): string => {
          const encodedFileName = encodeURIComponent(fileName);
          return `https://purdue.brightspace.com/content/enforced/${courseId}-wl.${courseDescriptor}/${encodedFileName}`;
        };

        const pdfLinks: PdfLink[] = [];
        
        // Method 1: Find links with "PDF document" in the title
        document.querySelectorAll('a[title*="PDF document"]').forEach(link => {
          const title = link.textContent?.trim() || "Untitled PDF";
          const fileName = title.endsWith('.pdf') ? title : `${title}.pdf`;
          pdfLinks.push({ 
            title, 
            url: constructPdfViewerUrl(fileName),
            fileName 
          });
        });
        
        // Method 2: Find links that end with .pdf
        document.querySelectorAll('a[href$=".pdf"]').forEach(link => {
          const title = link.textContent?.trim() || "Untitled PDF";
          if (!pdfLinks.some(item => item.title === title)) {
            const fileName = title.endsWith('.pdf') ? title : `${title}.pdf`;
            pdfLinks.push({ 
              title, 
              url: constructPdfViewerUrl(fileName),
              fileName 
            });
          }
        });
        
        // Method 3: Find links that contain PDF viewer URLs
        document.querySelectorAll('a[href*="pdfjs-d2l-dist"]').forEach(link => {
          const title = link.textContent?.trim() || "Untitled PDF";
          if (!pdfLinks.some(item => item.title === title)) {
            const fileName = title.endsWith('.pdf') ? title : `${title}.pdf`;
            pdfLinks.push({ 
              title, 
              url: constructPdfViewerUrl(fileName),
              fileName 
            });
          }
        });

        return pdfLinks;
      },
      args: [courseId, courseDescriptor]
    });

    // Close the tab
    await chrome.tabs.remove(tab.id);

    // Store results using Plasmo storage
    await storage.set('currentScanResults', results.result || []);

    // Send response with results
    res.send({
      success: true,
      pdfLinks: results.result || []
    });

  } catch (error) {
    console.error("Error scanning content page:", error);
    if (tab?.id) {
      try {
        await chrome.tabs.remove(tab.id);
      } catch (e) {
        console.error("Error closing tab:", e);
      }
    }
    res.send({
      success: false,
      error: error.message
    });
  } finally {
    // Clear scanning flag using Plasmo storage
    await storage.set('isScanning', false);
  }
}

export default handler
