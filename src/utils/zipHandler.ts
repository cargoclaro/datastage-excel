import JSZip from 'jszip';

interface ZipHandlerOptions {
  onProgress: (percent: number) => void;
  onError: (error: string) => void;
  onInfo?: (info: string) => void;
}

/**
 * Extract .asc files from a ZIP file
 */
export const extractAscFromZip = async (
  zipFile: File, 
  options: ZipHandlerOptions
): Promise<Map<string, string>> => {
  const { onProgress, onError, onInfo } = options;
  const fileContents = new Map<string, string>();
  
  const logInfo = (message: string) => {
    console.log(message);
    if (onInfo) onInfo(message);
  };
  
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
    
    // Log all files found in the ZIP for debugging
    const allFiles = Object.keys(zipContent.files);
    logInfo(`Found ${allFiles.length} total items in ZIP file`);
    
    // Get all files and directories in the ZIP
    const directories = allFiles.filter(path => zipContent.files[path].dir);
    const files = allFiles.filter(path => !zipContent.files[path].dir);
    
    logInfo(`- ${directories.length} directories`);
    logInfo(`- ${files.length} files`);
    
    if (directories.length > 0) {
      logInfo(`Directories found: ${directories.slice(0, 3).join(', ')}${directories.length > 3 ? '...' : ''}`);
    }
    
    // Look for .asc files in any directory
    const ascFiles = files.filter(filename => filename.toLowerCase().endsWith('.asc'));
    
    logInfo(`Found ${ascFiles.length} .asc files in the ZIP`);
    if (ascFiles.length > 0) {
      logInfo(`ASC files: ${ascFiles.slice(0, 5).join(', ')}${ascFiles.length > 5 ? '...' : ''}`);
    }
    
    if (ascFiles.length === 0) {
      // Log file extensions to help the user
      const extensions = new Set(files.map(f => {
        const ext = f.split('.').pop()?.toLowerCase() || '';
        return ext ? `.${ext}` : '(no extension)';
      }));
      
      logInfo(`File extensions found: ${Array.from(extensions).join(', ')}`);
      
      // Check for files that might be ASC but with different extensions
      const possibleTextFiles = files.filter(file => {
        const lowerName = file.toLowerCase();
        return lowerName.endsWith('.txt') || 
               lowerName.endsWith('.csv') || 
               lowerName.endsWith('.dat') ||
               lowerName.includes('asc');
      });
      
      if (possibleTextFiles.length > 0) {
        logInfo(`Found ${possibleTextFiles.length} potential text files that might contain ASC data`);
        logInfo(`Examples: ${possibleTextFiles.slice(0, 3).join(', ')}${possibleTextFiles.length > 3 ? '...' : ''}`);
        
        // Extract a few samples to check content
        try {
          const sampleFile = possibleTextFiles[0];
          const sampleContent = await zipContent.files[sampleFile].async('string');
          const firstLine = sampleContent.split('\n')[0].slice(0, 100);
          logInfo(`Sample from ${sampleFile}: "${firstLine}${firstLine.length > 100 ? '...' : ''}"`);
          
          // Check if it has pipe delimiters which would suggest it's an ASC file with wrong extension
          if (firstLine.includes('|')) {
            logInfo('This looks like pipe-delimited data! Treating these as ASC files.');
            // Process these files as ASC files
            for (const textFile of possibleTextFiles) {
              try {
                const content = await zipContent.files[textFile].async('string');
                const simpleFilename = textFile.split('/').pop() || textFile;
                fileContents.set(simpleFilename, content);
              } catch (error) {
                logInfo(`Failed to process ${textFile}: ${error}`);
              }
            }
            
            if (fileContents.size > 0) {
              onProgress(100);
              return fileContents;
            }
          }
        } catch (e) {
          logInfo(`Error examining sample file: ${e}`);
        }
        
        onError(`No .asc files found, but found ${possibleTextFiles.length} text files. Check if they need to be renamed with .asc extension.`);
      } else {
        onError('No .asc files found in the ZIP file. Please ensure your ZIP contains .asc files or check subdirectories.');
      }
      return fileContents;
    }
    
    // Process each ASC file
    let processedCount = 0;
    let errorCount = 0;
    
    const promises = ascFiles.map(async (filename) => {
      try {
        // Get the file content as text
        const content = await zipContent.files[filename].async('string');
        
        // Get just the filename without path
        const simpleFilename = filename.split('/').pop() || filename;
        
        // Store the content in the map with the simple filename
        fileContents.set(simpleFilename, content);
        logInfo(`Successfully processed: ${simpleFilename}`);
        
        // Update progress (50-100%)
        processedCount++;
        const percent = 50 + (processedCount / ascFiles.length) * 50;
        onProgress(percent);
      } catch (err) {
        errorCount++;
        logInfo(`Error extracting file ${filename}: ${err}`);
        
        if (errorCount === ascFiles.length) {
          onError('Failed to extract any files from the ZIP. The files might be corrupted.');
        }
      }
    });
    
    await Promise.all(promises);
    
    if (fileContents.size === 0 && ascFiles.length > 0) {
      onError('Found ASC files but couldn\'t extract their contents. The files might be corrupted or empty.');
    }
    
    return fileContents;
  } catch (error) {
    onError('Error extracting ZIP file: ' + (error instanceof Error ? error.message : String(error)));
    console.error('Error extracting ZIP:', error);
    return fileContents;
  }
}; 