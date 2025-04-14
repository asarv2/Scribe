/**
 * client/utils/services/microsoft.ts
 * This file contains the service for microsoft
 * @AshokSaravanan222
 * 05.04.2025
 */
"use server";
import { cookies } from "next/headers";
import useSupabaseServer from "../supabase/supabase-server";
import { OneDrive, OneDriveFolder } from "@/types";
import "isomorphic-fetch"; // or import the fetch polyfill you installed
import { Client } from "@microsoft/microsoft-graph-client";
import { DriveItem } from "@microsoft/microsoft-graph-types";

export const upsertOneDrive = async (
  profileId: string,
  token: string,
  refreshToken: string,
  expiresAt: string,
  onedriveId?: string,
) => {
  const supabase = await useSupabaseServer(cookies());
  const updates = {
    profile: profileId,
    provider_token: token,
    refresh_token: refreshToken,
    expires_at: expiresAt,
  } as OneDrive;
  if (onedriveId) {
    updates.id = onedriveId;
  }
  const { data, error } = await supabase.from("onedrive").upsert(updates);
  if (error) {
    throw new Error(error.message);
  }

  return data;
};

export const updateRootFolder = async (
  classId: string,
  newRootFolder: string,
) => {
  const supabase = await useSupabaseServer(cookies());
  const { error } = await supabase
    .from("classes")
    .update({ root_folder: newRootFolder })
    .eq("id", classId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, error: null };
};

/**
 * Creates a Microsoft Graph client using the provided access token
 */
export async function createGraphClient(accessToken: string) {
  // Create an authentication provider that uses the provided token
  const authProvider = (callback: any) => {
    callback(null, accessToken);
  };

  // Initialize the Graph client with debugging options
  const client = Client.init({
    authProvider,
    debugLogging: true, // Enable debug logging to see more details about requests
  });

  return client;
}

/**
 * Gets OneDrive folders with automatic token refresh
 * @param onedriveId The ID of the OneDrive record
 * @param maxDepth Maximum depth of subfolders to fetch (default: 3)
 * @returns Array of folders with path information and parent-child relationships
 */
export async function getOneDriveFolders(
  onedriveId: string,
  maxDepth = 3,
): Promise<OneDriveFolder[]> {
  try {
    const client = await createAuthenticatedGraphClient(onedriveId);

    // New behavior: Get folders up to maxDepth levels deep
    const allFolders: OneDriveFolder[] = [];
    const folderMap: Record<string, OneDriveFolder> = {};

    // Function to fetch folders up to a certain depth
    async function fetchFoldersWithDepth(
      folderId = "root",
      parentPath = "",
      currentDepth = 0,
      parentId?: string,
    ) {
      if (currentDepth > maxDepth) return;

      const endpoint = folderId === "root"
        ? "/me/drive/root/children?$filter=folder ne null"
        : `/me/drive/items/${folderId}/children?$filter=folder ne null`;

      try {
        const response = await client.api(endpoint).get();
        const folders = response.value as DriveItem[];

        if (folders) {
          for (const folder of folders) {
            const folderWithPath: OneDriveFolder = {
              id: folder.id || "",
              name: folder.name || "",
              path: parentPath,
              parentId: parentId,
              children: [],
              level: currentDepth,
            };

            // Store in map for quick lookup
            folderMap[folderWithPath.id] = folderWithPath;
            
            // Add to parent's children if applicable
            if (parentId && folderMap[parentId]) {
              folderMap[parentId].children?.push(folderWithPath);
            }

            allFolders.push(folderWithPath);

            // Only recurse if we haven't reached max depth
            if (currentDepth < maxDepth) {
              await fetchFoldersWithDepth(
                folder.id || "",
                parentPath ? `${parentPath}/${folder.name}` : folder.name || "",
                currentDepth + 1,
                folder.id,
              );
            }
          }
        }
      } catch (error) {
        console.error(
          `Error fetching folders at depth ${currentDepth} for folder ${folderId}:`,
          error,
        );
        // Continue with other folders even if one fails
      }
    }

    // Start fetching from root at depth 0
    await fetchFoldersWithDepth();

    return allFolders;
  } catch (error: any) {
    console.error("Error fetching OneDrive folders:", error);
    // Return empty array instead of throwing to prevent UI errors
    return [];
  }
}

/**
 * Gets a valid Microsoft Graph API access token, refreshing if necessary
 * @param onedriveId The ID of the OneDrive record
 * @returns A valid access token
 */
export async function getValidAccessToken(onedriveId: string) {
  const { accessToken } = await refreshMicrosoftToken(onedriveId);
  return accessToken;
}

/**
 * Creates a Microsoft Graph client with automatic token refresh
 * @param onedriveId The ID of the OneDrive record
 */
export async function createAuthenticatedGraphClient(onedriveId: string) {
  const accessToken = await getValidAccessToken(onedriveId);
  return createGraphClient(accessToken);
}

/**
 * Gets OneDrive files with automatic token refresh
 * @param onedriveId The ID of the OneDrive record
 * @param folderId Optional folder ID to list files from
 */
export async function getOneDriveFilesWithAuth(
  onedriveId: string,
  folderId?: string,
): Promise<DriveItem[]> {
  try {
    const client = await createAuthenticatedGraphClient(onedriveId);

    // Use the specified folder if provided, otherwise use root
    const endpoint = folderId
      ? `/me/drive/items/${folderId}/children`
      : "/me/drive/root/children";

    const response = await client.api(endpoint).get();
    return response.value as DriveItem[];
  } catch (error: any) {
    console.error("Error fetching OneDrive files:", error);
    throw error;
  }
}

/**
 * Refreshes the Microsoft Graph API token if expired
 * @param onedriveId The ID of the OneDrive record to refresh
 * @returns The refreshed access token and updated OneDrive record
 */
export async function refreshMicrosoftToken(onedriveId: string) {
  const supabase = await useSupabaseServer(cookies());

  // Get the current OneDrive record
  const { data: onedrive, error: fetchError } = await supabase
    .from("onedrive")
    .select("*")
    .eq("id", onedriveId)
    .single();

  if (fetchError || !onedrive) {
    throw new Error(fetchError?.message || "OneDrive record not found");
  }

  // Check if token is expired
  const now = new Date();
  const expiresAt = new Date(onedrive.expires_at || "");

  // If token is still valid, return it
  if (expiresAt > now) {
    return {
      accessToken: onedrive.provider_token,
      onedrive,
    };
  }

  // Token is expired, refresh it
  try {
    // Microsoft OAuth token endpoint
    const tokenEndpoint =
      "https://login.microsoftonline.com/common/oauth2/v2.0/token";

    // Get client ID and secret from environment variables
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Microsoft OAuth credentials not configured");
    }

    // Prepare the request body
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: onedrive.refresh_token,
      redirect_uri: redirectUri,
      grant_type: "refresh_token",
    });

    // Make the request to refresh the token
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Token refresh failed: ${
          errorData.error_description || "Unknown error"
        }`,
      );
    }

    const tokenData = await response.json();

    // Calculate new expiration time
    const expiresInSeconds = tokenData.expires_in || 3600;
    const newExpiresAt = new Date(now.getTime() + expiresInSeconds * 1000)
      .toISOString();

    // Update the OneDrive record with new token information
    const updatedOneDrive = await upsertOneDrive(
      onedrive.profile,
      tokenData.access_token,
      tokenData.refresh_token || onedrive.refresh_token, // Use new refresh token if provided
      newExpiresAt,
      onedriveId,
    );

    return {
      accessToken: tokenData.access_token,
      onedrive: updatedOneDrive,
    };
  } catch (error: any) {
    console.error("Error refreshing Microsoft token:", error);
    throw error;
  }
}

/**
 * Upserts OneDrive files to the database
 * @param classId The class ID
 * @param files The files from OneDrive API
 * @param active Whether these files are active
 */
export async function upsertOneDriveFiles(
  classId: string,
  files: DriveItem[],
  active: boolean = true,
) {
  const supabase = await useSupabaseServer(cookies());

  // Prepare the data for upsert
  const fileRecords = files.map((file) => ({
    class: classId,
    item: file.id,
    name: file.name || "",
    active: active,
  }));

  // Upsert the files
  const { data, error } = await supabase
    .from("onedrive_files")
    .upsert(fileRecords, {
      onConflict: "item",
    });

  if (error) {
    console.error("Error upserting OneDrive files:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Deactivates all OneDrive files for a class
 * @param classId The class ID
 */
export async function deactivateAllOneDriveFiles(classId: string) {
  const supabase = await useSupabaseServer(cookies());

  const { error } = await supabase
    .from("onedrive_files")
    .update({ active: false })
    .eq("class", classId);

  if (error) {
    console.error("Error deactivating OneDrive files:", error);
    throw new Error(error.message);
  }

  return { success: true };
}

/**
 * Gets OneDrive files with automatic token refresh and updates the database
 * @param onedriveId The ID of the OneDrive record
 * @param classId The class ID
 * @param folderId Optional folder ID to list files from
 */
export async function getAndSyncOneDriveFiles(
  onedriveId: string,
  classId: string,
  folderId?: string,
): Promise<DriveItem[]> {
  try {
    // Get files from Microsoft Graph API
    const files = await getOneDriveFilesWithAuth(onedriveId, folderId);

    // Upsert files to database
    await upsertOneDriveFiles(classId, files);

    return files;
  } catch (error: any) {
    console.error("Error syncing OneDrive files:", error);
    throw error;
  }
}

/**
 * Gets OneDrive folder structure with files
 * @param onedriveId The ID of the OneDrive record
 * @param rootFolderId The root folder ID to start from
 * @param maxDepth Maximum depth of subfolders to fetch (default: 2)
 * @returns Hierarchical structure of folders and files
 */
export async function getOneDriveFolderStructure(
  onedriveId: string,
  rootFolderId?: string,
  maxDepth = 3,
): Promise<{ folders: OneDriveFolder[]; files: DriveItem[] }> {
  try {
    if (!onedriveId) {
      return { folders: [], files: [] };
    }
    
    const client = await createAuthenticatedGraphClient(onedriveId);
    const allFiles: DriveItem[] = [];
    const folderMap: Record<string, OneDriveFolder> = {};
    
    // Function to recursively fetch folder contents
    async function fetchFolderContents(folderId: string, parentPath = "", depth = 0, parentId?: string) {
      if (depth > maxDepth) return;
      
      const endpoint = folderId === "root" 
        ? "/me/drive/root/children"
        : `/me/drive/items/${folderId}/children`;
      
      try {
        const response = await client.api(endpoint).get();
        const items = response.value || [];
        
        for (const item of items) {
          if (item.folder) {
            // It's a folder
            const folder: OneDriveFolder = {
              id: item.id || "",
              name: item.name || "",
              path: parentPath ? `${parentPath}/${item.name}` : item.name || "",
              parentId: parentId,
              children: [],
              level: depth
            };
            
            folderMap[folder.id] = folder;
            
            // Recursively fetch contents if not at max depth
            if (depth < maxDepth) {
              await fetchFolderContents(
                item.id || "", 
                folder.path,
                depth + 1,
                folder.id
              );
            }
          } else {
            // It's a file
            allFiles.push(item);
          }
        }
      } catch (error) {
        console.error(`Error fetching contents of folder ${folderId}:`, error);
      }
    }
    
    // Start with the specified root folder or use "root" if not provided
    const startFolderId = rootFolderId || "root";
    await fetchFolderContents(startFolderId);
    
    // Build the folder hierarchy
    const rootFolders: OneDriveFolder[] = [];
    
    // First pass: identify all folders
    Object.values(folderMap).forEach(folder => {
      // If this folder has a parent and the parent exists in our map
      if (folder.parentId && folderMap[folder.parentId]) {
        // Add this folder as a child of its parent
        folderMap[folder.parentId].children?.push(folder);
      } else if (!folder.parentId || folder.parentId === startFolderId) {
        // This is a top-level folder
        rootFolders.push(folder);
      }
    });
    
    return {
      folders: rootFolders,
      files: allFiles
    };
  } catch (error) {
    console.error("Error fetching OneDrive folder structure:", error);
    return { folders: [], files: [] };
  }
}