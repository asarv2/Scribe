import type { PlasmoMessaging } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"

interface CreateCourseRequest {
  courseId: string
  courseDescriptor: string
  profileId: string
}

interface CreateCourseResponse {
  success: boolean
  message?: string
  error?: string
  classId?: string
}

const handler: PlasmoMessaging.MessageHandler<CreateCourseRequest, CreateCourseResponse> = async (req, res) => {
  const { courseId, courseDescriptor, profileId } = req.body;
  const storage = new Storage();
  
  try {
    // Update status
    await storage.set(`createStatus_${courseId}`, 'Getting syllabus...');
    
    let syllabusTab: chrome.tabs.Tab | undefined;
    let syllabusFileName: string | null = null;
    let syllabusBlob: Blob | null = null;
    
    // Try to get the syllabus
    const overviewPageUrl = `https://purdue.brightspace.com/d2l/le/content/${courseId}/Home?itemIdentifier=Overview`;
    console.log("[Background] Creating syllabus tab...");
    syllabusTab = await chrome.tabs.create({ url: overviewPageUrl, active: false });
    
    if (!syllabusTab || !syllabusTab.id) {
      console.warn("Failed to create syllabus tab, continuing without syllabus");
    } else {
      console.log("[Background] Syllabus tab created:", syllabusTab.id);
      
      // Wait for syllabus page to load
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn("Syllabus page load timeout, continuing without syllabus");
          resolve(null);
        }, 30000);
        
        const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
          if (tabId === syllabusTab.id && changeInfo.status === 'complete') {
            console.log("[Background] Syllabus tab loaded:", tabId);
            chrome.tabs.onUpdated.removeListener(listener);
            clearTimeout(timeout);
            setTimeout(resolve, 2000); // Add a small delay after page load
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });

      // Execute content script to find syllabus iframe
      if (syllabusTab.id) {
        try {
          const [syllabusResults] = await chrome.scripting.executeScript({
            target: { tabId: syllabusTab.id },
            func: () => {
              const iframe = document.querySelector('iframe.d2l-fileviewer-rendered-pdf') as HTMLIFrameElement;
              if (!iframe) return null;
              
              const title = iframe.getAttribute('title');
              if (!title) return null;
              
              // Get the src URL to extract file information if needed
              const src = iframe.getAttribute('src');
              
              return { title, src };
            }
          });

          console.log("[Background] Syllabus detection results:", syllabusResults);
          
          if (syllabusResults?.result?.title) {
            syllabusFileName = syllabusResults.result.title;
            
            // Try to download the syllabus
            await storage.set(`createStatus_${courseId}`, 'Downloading syllabus...');
            
            // Get cookies for authentication
            const cookies = await chrome.cookies.getAll({ url: `https://purdue.brightspace.com` });
            const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
            
            // Construct the syllabus URL
            const syllabusUrl = `https://purdue.brightspace.com/content/enforced/${courseId}-wl.${courseDescriptor}/${encodeURIComponent(syllabusFileName)}`;
            console.log("[Background] Attempting to download syllabus from:", syllabusUrl);
            
            // Fetch the syllabus
            const syllabusResponse = await fetch(syllabusUrl, {
              headers: {
                'Cookie': cookieHeader
              }
            });

            if (syllabusResponse.ok) {
              syllabusBlob = await syllabusResponse.blob();
              console.log("[Background] Syllabus downloaded successfully:", {
                fileName: syllabusFileName,
                size: syllabusBlob.size
              });
            } else {
              console.warn("[Background] Failed to download syllabus:", syllabusResponse.status, syllabusResponse.statusText);
            }
          }
        } catch (error) {
          console.warn("[Background] Error getting syllabus:", error);
        }
        
        // Close the syllabus tab
        chrome.tabs.remove(syllabusTab.id).catch(() => {
          // Ignore tab closing errors
        });
      }
    }
    
    // Update status
    await storage.set(`createStatus_${courseId}`, 'Creating course...');
    
    // Create FormData to send the files
    const formData = new FormData();
    formData.append('course_id', courseId);
    formData.append('course_descriptor', courseDescriptor);
    formData.append('profile_id', profileId);
    
    // Add syllabus if available
    if (syllabusFileName && syllabusBlob) {
      formData.append('syllabus_file', new File([syllabusBlob], syllabusFileName));
      formData.append('syllabus_filename', syllabusFileName);
      console.log("[Background] Added syllabus to upload:", syllabusFileName);
    }
    
    // Send to server
    const createResult = await fetch(`${process.env.PLASMO_PUBLIC_API_URL}/upload/create`, {
      method: 'POST',
      body: formData
    });
    
    if (!createResult.ok) {
      throw new Error(`Create failed: ${createResult.status} ${createResult.statusText}`);
    }
    
    const responseData = await createResult.json();
    console.log('[Background] Course creation successful:', responseData);
    
    await storage.set(`createStatus_${courseId}`, 'Course created successfully! ✅');
    
    res.send({
      success: true,
      message: "Course created successfully",
      classId: responseData.classId
    });
    
  } catch (error) {
    console.error("[Background] Error creating course:", error);
    await storage.set(`createStatus_${courseId}`, `Error: ${error.message}`);
    
    res.send({
      success: false,
      error: error.message
    });
  }
};

export default handler;