/**
 * Google Docs Service
 * Handles Google Docs API operations for report generation
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CopyDocumentResult {
  docId: string;
  docUrl: string;
  title: string;
}

export interface DocumentMetadata {
  id: string;
  title: string;
  mimeType: string;
  createdTime: string;
  modifiedTime: string;
}

export interface PlaceholderReplacement {
  placeholder: string;
  value: string;
}

interface GoogleDocsRequest {
  replaceAllText?: {
    containsText: {
      text: string;
      matchCase: boolean;
    };
    replaceText: string;
  };
}

// ============================================================================
// GOOGLE DOCS SERVICE CLASS
// ============================================================================

export class GoogleDocsService {
  private accessToken: string | null = null;
  private readonly DOCS_API_BASE = 'https://docs.googleapis.com/v1/documents';
  private readonly DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files';

  /**
   * Initialize the service with an access token
   */
  initialize(accessToken: string): void {
    this.accessToken = accessToken;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.accessToken !== null;
  }

  /**
   * Make authenticated request to Google API
   */
  private async makeRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.accessToken) {
      throw new Error('GoogleDocsService not initialized. Call initialize() with access token first.');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || JSON.stringify(errorData);
      } catch {
        // Keep raw error text
      }
      throw new Error(`Google API request failed (${response.status}): ${errorMessage}`);
    }

    return response.json();
  }

  /**
   * Copy a Google Docs template to create a new document
   * @param templateId - The Google Doc ID of the template
   * @param newTitle - Title for the new document
   * @param destinationFolderId - Optional folder ID to place the copy
   */
  async copyTemplate(
    templateId: string,
    newTitle: string,
    destinationFolderId?: string
  ): Promise<CopyDocumentResult> {
    const copyMetadata: Record<string, unknown> = {
      name: newTitle,
    };

    if (destinationFolderId) {
      copyMetadata.parents = [destinationFolderId];
    }

    // Use Drive API to copy the document
    const result = await this.makeRequest<{
      id: string;
      name: string;
      webViewLink?: string;
    }>(
      `${this.DRIVE_API_BASE}/${templateId}/copy?supportsAllDrives=true`,
      {
        method: 'POST',
        body: JSON.stringify(copyMetadata),
      }
    );

    return {
      docId: result.id,
      docUrl: result.webViewLink || `https://docs.google.com/document/d/${result.id}/edit`,
      title: result.name,
    };
  }

  /**
   * Replace all placeholders in a document
   * @param docId - The Google Doc ID
   * @param replacements - Array of placeholder-value pairs
   */
  async replacePlaceholders(
    docId: string,
    replacements: PlaceholderReplacement[]
  ): Promise<void> {
    if (replacements.length === 0) {
      return;
    }

    // Build batch update requests
    const requests: GoogleDocsRequest[] = replacements.map((replacement) => ({
      replaceAllText: {
        containsText: {
          text: replacement.placeholder,
          matchCase: true,
        },
        replaceText: replacement.value,
      },
    }));

    // Execute batch update
    await this.makeRequest<unknown>(
      `${this.DOCS_API_BASE}/${docId}:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({ requests }),
      }
    );
  }

  /**
   * Replace placeholders using a Map
   */
  async replacePlaceholdersMap(
    docId: string,
    replacements: Map<string, string>
  ): Promise<void> {
    const replacementArray: PlaceholderReplacement[] = [];
    replacements.forEach((value, placeholder) => {
      replacementArray.push({ placeholder, value });
    });
    await this.replacePlaceholders(docId, replacementArray);
  }

  /**
   * Get document metadata
   */
  async getDocumentMetadata(docId: string): Promise<DocumentMetadata> {
    const result = await this.makeRequest<{
      documentId: string;
      title: string;
    }>(`${this.DOCS_API_BASE}/${docId}`);

    // Get additional metadata from Drive API
    const driveMetadata = await this.makeRequest<{
      id: string;
      name: string;
      mimeType: string;
      createdTime: string;
      modifiedTime: string;
    }>(
      `${this.DRIVE_API_BASE}/${docId}?fields=id,name,mimeType,createdTime,modifiedTime&supportsAllDrives=true`
    );

    return {
      id: result.documentId,
      title: result.title,
      mimeType: driveMetadata.mimeType,
      createdTime: driveMetadata.createdTime,
      modifiedTime: driveMetadata.modifiedTime,
    };
  }

  /**
   * Move a document to a different folder
   * @param docId - The document ID to move
   * @param newFolderId - The destination folder ID
   */
  async moveToFolder(docId: string, newFolderId: string): Promise<void> {
    // First, get current parents
    const fileInfo = await this.makeRequest<{
      parents?: string[];
    }>(
      `${this.DRIVE_API_BASE}/${docId}?fields=parents&supportsAllDrives=true`
    );

    const currentParents = fileInfo.parents?.join(',') || '';

    // Move to new folder
    await this.makeRequest<unknown>(
      `${this.DRIVE_API_BASE}/${docId}?addParents=${newFolderId}&removeParents=${currentParents}&supportsAllDrives=true`,
      {
        method: 'PATCH',
      }
    );
  }

  /**
   * Create a folder in Google Drive
   */
  async createFolder(
    folderName: string,
    parentFolderId?: string
  ): Promise<{ folderId: string; folderUrl: string }> {
    const metadata: Record<string, unknown> = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };

    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }

    const result = await this.makeRequest<{
      id: string;
    }>(
      `${this.DRIVE_API_BASE}?supportsAllDrives=true`,
      {
        method: 'POST',
        body: JSON.stringify(metadata),
      }
    );

    return {
      folderId: result.id,
      folderUrl: `https://drive.google.com/drive/folders/${result.id}`,
    };
  }

  /**
   * Ensure folder path exists, creating folders as needed
   * @param baseFolderId - The base folder ID to start from
   * @param pathParts - Array of folder names to create/navigate
   * @returns The ID of the final folder
   */
  async ensureFolderPath(
    baseFolderId: string,
    pathParts: string[]
  ): Promise<string> {
    let currentFolderId = baseFolderId;

    for (const folderName of pathParts) {
      // Search for existing folder
      const existingFolder = await this.findFolderByName(
        folderName,
        currentFolderId
      );

      if (existingFolder) {
        currentFolderId = existingFolder;
      } else {
        // Create the folder
        const newFolder = await this.createFolder(folderName, currentFolderId);
        currentFolderId = newFolder.folderId;
      }
    }

    return currentFolderId;
  }

  /**
   * Find a folder by name within a parent folder
   */
  private async findFolderByName(
    folderName: string,
    parentFolderId: string
  ): Promise<string | null> {
    const query = encodeURIComponent(
      `name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    );

    const result = await this.makeRequest<{
      files: Array<{ id: string; name: string }>;
    }>(
      `${this.DRIVE_API_BASE}?q=${query}&supportsAllDrives=true&includeItemsFromAllDrives=true`
    );

    return result.files?.[0]?.id || null;
  }

  /**
   * Delete a document
   */
  async deleteDocument(docId: string): Promise<void> {
    await this.makeRequest<unknown>(
      `${this.DRIVE_API_BASE}/${docId}?supportsAllDrives=true`,
      {
        method: 'DELETE',
      }
    );
  }

  /**
   * Set document permissions
   */
  async setPermission(
    docId: string,
    email: string,
    role: 'reader' | 'writer' | 'commenter'
  ): Promise<void> {
    await this.makeRequest<unknown>(
      `${this.DRIVE_API_BASE}/${docId}/permissions?supportsAllDrives=true`,
      {
        method: 'POST',
        body: JSON.stringify({
          type: 'user',
          role,
          emailAddress: email,
        }),
      }
    );
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const googleDocsService = new GoogleDocsService();

export default googleDocsService;
