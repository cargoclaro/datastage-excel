import JSZip from 'jszip';

interface ZipHandlerOptions {
  onProgress: (percent: number) => void;
  onError: (error: string) => void;
}

/**
 * Extract .asc files from a ZIP file
 */
export const extractAscFromZip = async (
  zipFile: File, 
  options: ZipHandlerOptions
): Promise<Map<string, string>> => {
  const { onProgress, onError } = options;
  const fileContents = new Map<string, string>();
  
  try {
    // Load the zip file
    const zip = new JSZip();
    
    // Use loadAsync with progress callback
    const zipContent = await zip.loadAsync(zipFile, {
      // Update progress during loading (0-50%)
      async: true,
      checkCRC32: true,
      onUpdate: (metadata) => {
        const percent = Math.min(metadata.percent / 2, 50);
        onProgress(percent);
      }
    });
    
    // Get all .asc files
    const ascFiles = Object.keys(zipContent.files).filter(
      filename => filename.toLowerCase().endsWith('.asc') && !zipContent.files[filename].dir
    );
    
    if (ascFiles.length === 0) {
      onError('No .asc files found in the ZIP file');
      return fileContents;
    }
    
    // Process each file
    let processedCount = 0;
    
    const promises = ascFiles.map(async (filename) => {
      // Get the file content as text
      const content = await zipContent.files[filename].async('string');
      
      // Store the content in the map
      fileContents.set(filename, content);
      
      // Update progress (50-100%)
      processedCount++;
      const percent = 50 + (processedCount / ascFiles.length) * 50;
      onProgress(percent);
    });
    
    await Promise.all(promises);
    
    return fileContents;
  } catch (error) {
    onError('Error extracting ZIP file: ' + (error instanceof Error ? error.message : String(error)));
    return fileContents;
  }
}; 