import { Client } from '@microsoft/microsoft-graph-client';

type StorageProvider = 'sharepoint' | 'onedrive';

interface ConnectionSettings {
  settings?: {
    access_token?: string;
    expires_at?: string;
    oauth?: {
      credentials?: {
        access_token?: string;
      };
    };
  };
}

const connectionCache: Record<StorageProvider, ConnectionSettings | null> = {
  sharepoint: null,
  onedrive: null,
};

async function getAccessToken(provider: StorageProvider): Promise<string> {
  const cached = connectionCache[provider];
  if (cached?.settings?.expires_at && 
      new Date(cached.settings.expires_at).getTime() > Date.now()) {
    const token = cached.settings?.access_token || 
                  cached.settings?.oauth?.credentials?.access_token;
    if (token) return token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Replit connector environment not available');
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=${provider}`,
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );

  const data = await response.json();
  connectionCache[provider] = data.items?.[0] || null;

  const accessToken = connectionCache[provider]?.settings?.access_token || 
                      connectionCache[provider]?.settings?.oauth?.credentials?.access_token;

  if (!connectionCache[provider] || !accessToken) {
    throw new Error(`${provider === 'sharepoint' ? 'SharePoint' : 'OneDrive'} not connected via Replit`);
  }
  
  return accessToken;
}

export async function isStorageConnected(provider: StorageProvider): Promise<boolean> {
  try {
    await getAccessToken(provider);
    return true;
  } catch {
    return false;
  }
}

export async function getStorageUserEmail(provider: StorageProvider): Promise<string | null> {
  try {
    const client = await getUncachableClient(provider);
    const user = await client.api('/me').select('mail,userPrincipalName').get();
    return user.mail || user.userPrincipalName || null;
  } catch (error) {
    console.error(`[${provider.toUpperCase()}] Failed to get user email:`, error);
    return null;
  }
}

export async function getUncachableClient(provider: StorageProvider): Promise<Client> {
  const accessToken = await getAccessToken(provider);

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

export interface DriveInfo {
  id: string;
  name: string;
  driveType: string;
  webUrl: string;
  owner?: {
    user?: {
      displayName?: string;
      email?: string;
    };
  };
}

export async function getUserDrive(provider: StorageProvider): Promise<DriveInfo | null> {
  try {
    const client = await getUncachableClient(provider);
    const drive = await client.api('/me/drive').get();
    return {
      id: drive.id,
      name: drive.name,
      driveType: drive.driveType,
      webUrl: drive.webUrl,
      owner: drive.owner,
    };
  } catch (error) {
    console.error(`[${provider.toUpperCase()}] Failed to get user drive:`, error);
    return null;
  }
}

export interface SharePointSite {
  id: string;
  name: string;
  displayName: string;
  webUrl: string;
}

export async function getSharePointSites(): Promise<SharePointSite[]> {
  try {
    const client = await getUncachableClient('sharepoint');
    const response = await client.api('/sites?search=*').get();
    return (response.value || []).map((site: any) => ({
      id: site.id,
      name: site.name,
      displayName: site.displayName,
      webUrl: site.webUrl,
    }));
  } catch (error) {
    console.error('[SHAREPOINT] Failed to get sites:', error);
    return [];
  }
}

export async function getSiteDrives(siteId: string): Promise<DriveInfo[]> {
  try {
    const client = await getUncachableClient('sharepoint');
    const response = await client.api(`/sites/${siteId}/drives`).get();
    return (response.value || []).map((drive: any) => ({
      id: drive.id,
      name: drive.name,
      driveType: drive.driveType,
      webUrl: drive.webUrl,
      owner: drive.owner,
    }));
  } catch (error) {
    console.error('[SHAREPOINT] Failed to get site drives:', error);
    return [];
  }
}

export interface FolderInfo {
  id: string;
  name: string;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  size: number;
  folder?: {
    childCount: number;
  };
}

export async function createFolder(
  provider: StorageProvider,
  driveId: string,
  parentPath: string,
  folderName: string
): Promise<FolderInfo | null> {
  try {
    const client = await getUncachableClient(provider);
    const parentPathEncoded = parentPath === '/' ? 'root' : `root:${parentPath}:`;
    
    const folder = await client
      .api(`/drives/${driveId}/${parentPathEncoded}/children`)
      .post({
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename'
      });
    
    console.log(`[${provider.toUpperCase()}] Created folder: ${folderName}`);
    return {
      id: folder.id,
      name: folder.name,
      webUrl: folder.webUrl,
      createdDateTime: folder.createdDateTime,
      lastModifiedDateTime: folder.lastModifiedDateTime,
      size: folder.size || 0,
      folder: folder.folder,
    };
  } catch (error) {
    console.error(`[${provider.toUpperCase()}] Failed to create folder:`, error);
    return null;
  }
}

export async function ensureLegalNoteFolderStructure(
  provider: StorageProvider,
  driveId: string
): Promise<{ rootFolder: FolderInfo | null; casesFolder: FolderInfo | null }> {
  const rootFolder = await createFolder(provider, driveId, '/', 'LegalNote AI');
  if (!rootFolder) {
    return { rootFolder: null, casesFolder: null };
  }
  
  const casesFolder = await createFolder(provider, driveId, '/LegalNote AI', 'Cases');
  return { rootFolder, casesFolder };
}

export interface UploadedFile {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

export async function uploadFile(
  provider: StorageProvider,
  driveId: string,
  folderPath: string,
  fileName: string,
  content: Buffer | string,
  mimeType: string
): Promise<UploadedFile | null> {
  try {
    const client = await getUncachableClient(provider);
    const folderPathEncoded = folderPath === '/' ? 'root' : `root:${folderPath}`;
    const filePath = `${folderPathEncoded}:/${fileName}:/content`;
    
    const uploadSession = await client
      .api(`/drives/${driveId}/${filePath}`)
      .header('Content-Type', mimeType)
      .put(content);
    
    console.log(`[${provider.toUpperCase()}] Uploaded file: ${fileName}`);
    return {
      id: uploadSession.id,
      name: uploadSession.name,
      webUrl: uploadSession.webUrl,
      size: uploadSession.size,
      createdDateTime: uploadSession.createdDateTime,
      lastModifiedDateTime: uploadSession.lastModifiedDateTime,
    };
  } catch (error) {
    console.error(`[${provider.toUpperCase()}] Failed to upload file:`, error);
    return null;
  }
}

export async function syncDocumentToStorage(
  provider: StorageProvider,
  driveId: string,
  caseTitle: string,
  clientName: string,
  documentType: string,
  fileName: string,
  content: Buffer | string,
  mimeType: string
): Promise<UploadedFile | null> {
  const sanitizedCaseTitle = caseTitle.replace(/[<>:"/\\|?*]/g, '-').substring(0, 100);
  const caseFolderPath = `/LegalNote AI/Cases/${clientName} - ${sanitizedCaseTitle}`;
  
  await createFolder(provider, driveId, '/LegalNote AI/Cases', `${clientName} - ${sanitizedCaseTitle}`);
  
  const typeFolder = documentType === 'attendance_note' ? 'Attendance Notes' : 
                     documentType === 'ai_summary' ? 'AI Summaries' : 
                     documentType === 'transcript' ? 'Transcripts' : 'Documents';
  
  await createFolder(provider, driveId, caseFolderPath, typeFolder);
  
  return await uploadFile(
    provider,
    driveId,
    `${caseFolderPath}/${typeFolder}`,
    fileName,
    content,
    mimeType
  );
}

export async function listFolderContents(
  provider: StorageProvider,
  driveId: string,
  folderPath: string
): Promise<any[]> {
  try {
    const client = await getUncachableClient(provider);
    const folderPathEncoded = folderPath === '/' ? 'root' : `root:${folderPath}:`;
    
    const response = await client
      .api(`/drives/${driveId}/${folderPathEncoded}/children`)
      .get();
    
    return response.value || [];
  } catch (error) {
    console.error(`[${provider.toUpperCase()}] Failed to list folder:`, error);
    return [];
  }
}

export async function deleteItem(
  provider: StorageProvider,
  driveId: string,
  itemId: string
): Promise<boolean> {
  try {
    const client = await getUncachableClient(provider);
    await client.api(`/drives/${driveId}/items/${itemId}`).delete();
    console.log(`[${provider.toUpperCase()}] Deleted item: ${itemId}`);
    return true;
  } catch (error) {
    console.error(`[${provider.toUpperCase()}] Failed to delete item:`, error);
    return false;
  }
}

export async function getStorageInfo(provider: StorageProvider): Promise<{
  email: string | null;
  drive: DriveInfo | null;
  sites?: SharePointSite[];
}> {
  const email = await getStorageUserEmail(provider);
  const drive = await getUserDrive(provider);
  const sites = provider === 'sharepoint' ? await getSharePointSites() : undefined;
  
  return { email, drive, sites };
}
