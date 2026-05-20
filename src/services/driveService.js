import { useAuth } from '../contexts/AuthContext';

class DriveService {
  constructor() {
    this.apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
  }

  // Initialize Google Drive API
  async initializeDriveAPI(accessToken) {
    if (!window.gapi) {
      await this.loadGoogleAPI();
    }
    
    await new Promise((resolve) => {
      window.gapi.load('client', resolve);
    });

    await window.gapi.client.init({
      apiKey: this.apiKey,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
    });

    window.gapi.client.setToken({ access_token: accessToken });
  }

  // Load Google API script
  loadGoogleAPI() {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Extract folder ID from Google Drive URL
  extractFolderIdFromUrl(url) {
    if (!url) return null;
    
    // Handle different Google Drive URL formats
    const patterns = [
      /\/folders\/([a-zA-Z0-9-_]+)/,
      /id=([a-zA-Z0-9-_]+)/,
      /^([a-zA-Z0-9-_]+)$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  // Generate filename with project code and timestamp
  generateFileName(projectCode, outputType, originalFileName = '') {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS format
    
    const typeMap = {
      'pgbison': 'PGBison',
      'cutlistopt': 'CutlistOpt', 
      'katana': 'KatanaBOM'
    };

    const fileType = typeMap[outputType.toLowerCase()] || outputType;
    const baseFileName = originalFileName.replace(/\.[^/.]+$/, '') || 'cutlist';
    
    return `${projectCode}-${fileType}-${dateStr}-${timeStr}.csv`;
  }

  // Save file to Google Drive folder
  async saveToProjectFolder(fileContent, fileName, folderUrl, accessToken) {
    try {
      console.log('Save to Drive - Starting...', { fileName, folderUrl, hasToken: !!accessToken, tokenLength: accessToken?.length });
      
      if (!accessToken) {
        throw new Error('No Google access token available. Please sign out and sign back in.');
      }
      
      // Log token preview for debugging (first 20 chars only for security)
      console.log('Token preview:', accessToken.substring(0, 20) + '...');
      
      await this.initializeDriveAPI(accessToken);
      
      const folderId = this.extractFolderIdFromUrl(folderUrl);
      console.log('Extracted folder ID:', folderId, 'from URL:', folderUrl);
      
      if (!folderId) {
        throw new Error(`Invalid Google Drive folder URL: ${folderUrl}`);
      }

      // Skip folder verification - the upload API will give a clearer error if access is denied
      console.log('Attempting to upload to folder:', folderId);

      // Create file metadata
      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };

      // Convert content to blob
      const blob = new Blob([fileContent], { type: 'text/csv' });

      // Upload file using multipart upload with Shared Drive support
      console.log('Uploading file to Drive...', { fileName, folderId });
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
      form.append('file', blob);

      // Add supportsAllDrives=true to support Shared Drives (Team Drives)
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: form
      });

      console.log('Upload response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload error raw:', errorText);
        let errorMessage = errorText;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || JSON.stringify(errorData);
          console.error('Upload error parsed:', errorData);
        } catch (e) {
          console.error('Could not parse error response');
        }
        throw new Error(`Upload failed (${response.status}): ${errorMessage}`);
      }

      const result = await response.json();
      console.log('Upload successful:', result);
      
      return {
        success: true,
        fileId: result.id,
        fileName: result.name,
        webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
        message: `File "${fileName}" saved successfully to Google Drive`
      };

    } catch (error) {
      console.error('Error saving to Google Drive:', error);
      return {
        success: false,
        error: error.message,
        message: `Failed to save file: ${error.message}`
      };
    }
  }

  // Convert cutlist data to CSV format
  convertToCsv(data, headers = null) {
    if (!data || data.length === 0) {
      return '';
    }

    // Use provided headers or extract from first object
    const csvHeaders = headers || Object.keys(data[0]);
    
    // Create CSV content
    const csvRows = [
      csvHeaders.join(','), // Header row
      ...data.map(row => 
        csvHeaders.map(header => {
          const value = row[header] || '';
          // Escape commas and quotes in values
          return typeof value === 'string' && (value.includes(',') || value.includes('"'))
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        }).join(',')
      )
    ];

    return csvRows.join('\n');
  }

  // Save multiple output files (PG Bison, CutlistOpt, Katana BOM)
  async saveAllOutputs(outputs, projectCode, folderUrl, accessToken) {
    const results = [];

    for (const output of outputs) {
      const { type, data, headers } = output;
      const csvContent = this.convertToCsv(data, headers);
      const fileName = this.generateFileName(projectCode, type);
      
      const result = await this.saveToProjectFolder(
        csvContent, 
        fileName, 
        folderUrl, 
        accessToken
      );
      
      results.push({
        type,
        fileName,
        ...result
      });
    }

    return results;
  }

  // Create a folder in Google Drive
  async createFolder(folderName, parentFolderId, accessToken) {
    try {
      if (!accessToken) {
        throw new Error('No Google access token available. Please sign out and sign back in.');
      }

      await this.initializeDriveAPI(accessToken);

      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentFolderId && { parents: [parentFolderId] })
      };

      const response = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fileMetadata)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = errorText;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || JSON.stringify(errorData);
        } catch (e) {
          // Keep raw error text
        }
        throw new Error(`Folder creation failed (${response.status}): ${errorMessage}`);
      }

      const result = await response.json();
      console.log('Folder created:', result);

      return {
        success: true,
        folderId: result.id,
        folderName: result.name,
        webViewLink: `https://drive.google.com/drive/folders/${result.id}`
      };

    } catch (error) {
      console.error('Error creating folder:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create customer folder structure: Customer Name / Projects
  async createCustomerFolderStructure(customerName, customerCode, parentFolderId, accessToken) {
    try {
      // Create main customer folder
      const customerFolderName = `${customerCode} - ${customerName}`;
      const customerFolder = await this.createFolder(customerFolderName, parentFolderId, accessToken);
      
      if (!customerFolder.success) {
        throw new Error(customerFolder.error);
      }

      // Create Projects subfolder
      const projectsFolder = await this.createFolder('Projects', customerFolder.folderId, accessToken);
      
      return {
        success: true,
        customerFolderId: customerFolder.folderId,
        customerFolderLink: customerFolder.webViewLink,
        projectsFolderId: projectsFolder.success ? projectsFolder.folderId : null
      };

    } catch (error) {
      console.error('Error creating customer folder structure:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
const driveService = new DriveService();

// Hook for using drive service with authentication
export const useDriveService = () => {
  const { getGoogleAccessToken } = useAuth();

  const saveToProject = async (outputs, projectCode, folderUrl) => {
    const accessToken = getGoogleAccessToken();
    if (!accessToken) {
      throw new Error('Google Drive access token not available. Please sign in again.');
    }

    return await driveService.saveAllOutputs(outputs, projectCode, folderUrl, accessToken);
  };

  const saveSingleFile = async (fileContent, fileName, folderUrl) => {
    const accessToken = getGoogleAccessToken();
    if (!accessToken) {
      throw new Error('Google Drive access token not available. Please sign in again.');
    }

    return await driveService.saveToProjectFolder(fileContent, fileName, folderUrl, accessToken);
  };

  const createCustomerFolder = async (customerName, customerCode, parentFolderId = null) => {
    const accessToken = getGoogleAccessToken();
    if (!accessToken) {
      throw new Error('Google Drive access token not available. Please sign in again.');
    }

    return await driveService.createCustomerFolderStructure(customerName, customerCode, parentFolderId, accessToken);
  };

  return {
    saveToProject,
    saveSingleFile,
    createCustomerFolder,
    generateFileName: driveService.generateFileName.bind(driveService),
    convertToCsv: driveService.convertToCsv.bind(driveService)
  };
};

export default driveService;
