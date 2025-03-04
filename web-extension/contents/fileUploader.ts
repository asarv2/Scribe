// This file is used to upload files to the server

import type { PdfLink } from "./linkExtractor"
import { Storage } from "@plasmohq/storage"

// Initialize storage
const storage = new Storage()

const API_URL = process.env.PLASMO_PUBLIC_API_URL

// Function to upload a PDF to the server
export async function uploadPdf(url: string, title: string, courseId: string): Promise<{success: boolean, message: string}> {
  console.log(`Uploading PDF: ${title} from ${url}`);
  
  // Create a safe filename
  const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `${courseId}_${safeTitle}.pdf`;
  
  try {
    // Fetch the PDF with proper credentials
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    
    // Create FormData for upload
    const formData = new FormData();
    formData.append('file', blob, filename);
    formData.append('course_id', courseId);
    formData.append('title', title);
    formData.append('url', url);
    
    // Upload to server
    const uploadResponse = await fetch(`${API_URL}/upload/course`, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload PDF: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    const data = await uploadResponse.json();
    console.log(`PDF uploaded successfully: ${filename}`, data);
    return { success: true, message: "Upload successful" };
  } catch (error) {
    console.error(`Error processing PDF ${filename}:`, error);
    return { success: false, message: error.message };
  }
}

// Function to upload multiple PDFs
export async function uploadMultiplePdfs(
  pdfLinks: PdfLink[], 
  courseId: string,
  onProgress?: (current: number, total: number, title: string, status: 'success' | 'error') => void
): Promise<{success: boolean, message: string, successCount: number, results: {title: string, success: boolean}[]}> {
  let successCount = 0;
  const total = pdfLinks.length;
  const results: {title: string, success: boolean}[] = [];

  for (let i = 0; i < pdfLinks.length; i++) {
    const link = pdfLinks[i];
    
    try {
      const result = await uploadPdf(link.url, link.title, courseId);
      if (result.success) {
        successCount++;
        results.push({ title: link.title, success: true });
        onProgress?.(i + 1, total, link.title, 'success');
      } else {
        results.push({ title: link.title, success: false });
        onProgress?.(i + 1, total, link.title, 'error');
      }
    } catch (err) {
      results.push({ title: link.title, success: false });
      onProgress?.(i + 1, total, link.title, 'error');
    }

    // Small delay between uploads
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return {
    success: successCount > 0,
    message: `Successfully uploaded ${successCount} of ${total} PDFs`,
    successCount,
    results
  };
}