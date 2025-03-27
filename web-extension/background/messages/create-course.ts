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
    
    // Get class list data
    await storage.set(`createStatus_${courseId}`, 'Getting class list...');
    
    let studentEmails: string[] = [];
    let professorEmails: string[] = [];
    
    try {
      // Create a tab for the class list page
      const classListUrl = `https://purdue.brightspace.com/d2l/lms/classlist/print_email.d2l?pageOption=print&ou=${courseId}`;
      console.log("[Background] Creating class list tab...");
      const classListTab = await chrome.tabs.create({ url: classListUrl, active: false });
      
      if (classListTab && classListTab.id) {
        console.log("[Background] Class list tab created:", classListTab.id);
        
        // Wait for class list page to load
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.warn("Class list page load timeout, continuing without class list");
            resolve(null);
          }, 30000);
          
          const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
            if (tabId === classListTab.id && changeInfo.status === 'complete') {
              console.log("[Background] Class list tab loaded:", tabId);
              chrome.tabs.onUpdated.removeListener(listener);
              clearTimeout(timeout);
              setTimeout(resolve, 2000); // Add a small delay after page load
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });
        
        // Execute content script to extract emails
        const [classListResults] = await chrome.scripting.executeScript({
          target: { tabId: classListTab.id },
          func: () => {
            // Select the first table that has the required class names
            const table = document.querySelector("table.d2l-table.d2l-grid.d_gl") as HTMLTableElement | null;
            if (!table) {
              return { students: [], professors: [] };
            }
            
            // Select only the data rows (skip header rows marked with class "d_gh")
            const rows = table.querySelectorAll("tbody > tr:not(.d_gh)");
            const students: string[] = [];
            const professors: string[] = [];
            
            rows.forEach((row) => {
              // Assume the first label contains the email and the second contains the role.
              const labels = row.querySelectorAll("label");
              if (labels.length < 2) {
                return; // Skip rows that don't have the expected structure
              }
              
              const email = labels[0].textContent?.trim();
              const role = labels[1].textContent?.trim();
              
              if (email && role) {
                if (role === "Learner") {
                  students.push(email);
                } else {
                  professors.push(email);
                }
              }
            });
            
            return { students, professors };
          }
        });
        
        console.log("[Background] Class list extraction results:", classListResults);
        
        if (classListResults?.result) {
          studentEmails = classListResults.result.students || [];
          professorEmails = classListResults.result.professors || [];
          
          console.log("[Background] Extracted emails:", {
            students: studentEmails.length,
            professors: professorEmails.length
          });
        }
        
        // Close the class list tab
        chrome.tabs.remove(classListTab.id).catch(() => {
          // Ignore tab closing errors
        });
      }
    } catch (error) {
      console.warn("[Background] Error getting class list:", error);
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
    
    // Add student and professor emails
    formData.append('students', JSON.stringify(studentEmails));
    formData.append('professors', JSON.stringify(professorEmails));
    console.log("[Background] Added emails to upload:", {
      students: studentEmails.length,
      professors: professorEmails.length
    });
    
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
    
    await storage.set(`createStatus_${courseId}`, 'Course created successfully!');
    
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