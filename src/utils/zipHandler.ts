import JSZip from 'jszip';

interface ZipHandlerOptions {
  onProgress: (percent: number) => void;
  onError: (error: string) => void;
  onInfo?: (info: string) => void;
}

interface ExtractedFolder {
  folderName: string;
  files: Map<string, string>;
}

/**
 * Extract .asc files from a ZIP file including nested ZIPs
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
      // Update progress during loading (0-30%)
      async: true,
      checkCRC32: true,
      onUpdate: (metadata) => {
        const percent = Math.min(metadata.percent / 3, 30);
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
    let ascFiles = files.filter(filename => filename.toLowerCase().endsWith('.asc'));
    
    logInfo(`Found ${ascFiles.length} .asc files in the ZIP`);
    if (ascFiles.length > 0) {
      logInfo(`ASC files: ${ascFiles.slice(0, 5).join(', ')}${ascFiles.length > 5 ? '...' : ''}`);
    }
    
    // Look for nested ZIP files
    const nestedZipFiles = files.filter(filename => filename.toLowerCase().endsWith('.zip'));
    logInfo(`Found ${nestedZipFiles.length} nested ZIP files`);
    
    // Collect all extracted folders
    const extractedFolders: ExtractedFolder[] = [];
    
    // Process ASC files from the main ZIP
    if (ascFiles.length > 0) {
      const mainFolderFiles = new Map<string, string>();
      let processedCount = 0;
      
      // Process each ASC file in the main ZIP
      const mainZipPromises = ascFiles.map(async (filename) => {
        try {
          // Get the file content as text
          const content = await zipContent.files[filename].async('string');
          
          // Get just the filename without path
          const simpleFilename = filename.split('/').pop() || filename;
          
          // Store the content in the folder map
          mainFolderFiles.set(simpleFilename, content);
          logInfo(`Successfully processed: ${simpleFilename}`);
          
          // Update progress (30-60% for main ZIP)
          processedCount++;
          const percent = 30 + (processedCount / ascFiles.length) * 30;
          onProgress(percent);
        } catch (err) {
          logInfo(`Error extracting file ${filename}: ${err}`);
        }
      });
      
      await Promise.all(mainZipPromises);
      
      if (mainFolderFiles.size > 0) {
        extractedFolders.push({
          folderName: 'main',
          files: mainFolderFiles
        });
      }
    }
    
    // Process nested ZIP files
    if (nestedZipFiles.length > 0) {
      let processedZipCount = 0;
      
      // Process each nested ZIP file
      const nestedZipPromises = nestedZipFiles.map(async (zipFilePath, index) => {
        try {
          // Get the nested ZIP file as a blob
          const nestedZipBlob = await zipContent.files[zipFilePath].async('blob');
          const folderName = zipFilePath.split('/').pop()?.replace(/\.zip$/i, '') || `nested_${index}`;
          
          logInfo(`Processing nested ZIP: ${folderName}`);
          
          // Create a File object from the Blob
          const nestedZipFile = new File([nestedZipBlob], folderName + '.zip', { type: 'application/zip' });
          
          // Extract files from the nested ZIP
          const nestedZip = new JSZip();
          const nestedZipContent = await nestedZip.loadAsync(nestedZipFile);
          
          // Get all files from the nested ZIP
          const nestedAllFiles = Object.keys(nestedZipContent.files);
          const nestedFiles = nestedAllFiles.filter(path => !nestedZipContent.files[path].dir);
          
          // Find ASC files in the nested ZIP
          const nestedAscFiles = nestedFiles.filter(filename => filename.toLowerCase().endsWith('.asc'));
          logInfo(`Found ${nestedAscFiles.length} ASC files in nested ZIP: ${folderName}`);
          
          if (nestedAscFiles.length > 0) {
            const nestedFolderFiles = new Map<string, string>();
            
            // Process ASC files from the nested ZIP
            for (const nestedFilename of nestedAscFiles) {
              try {
                const content = await nestedZipContent.files[nestedFilename].async('string');
                const simpleFilename = nestedFilename.split('/').pop() || nestedFilename;
                nestedFolderFiles.set(simpleFilename, content);
                logInfo(`Successfully processed from nested ZIP: ${folderName}/${simpleFilename}`);
              } catch (err) {
                logInfo(`Error extracting nested file ${nestedFilename}: ${err}`);
              }
            }
            
            if (nestedFolderFiles.size > 0) {
              extractedFolders.push({
                folderName,
                files: nestedFolderFiles
              });
            }
          }
          
          // Update progress (60-90% for nested ZIPs)
          processedZipCount++;
          const percent = 60 + (processedZipCount / nestedZipFiles.length) * 30;
          onProgress(percent);
        } catch (zipErr) {
          logInfo(`Error processing nested ZIP ${zipFilePath}: ${zipErr}`);
        }
      });
      
      await Promise.all(nestedZipPromises);
    }
    
    // Check if we found any files
    if (extractedFolders.length === 0) {
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
            const textFolderFiles = new Map<string, string>();
            
            for (const textFile of possibleTextFiles) {
              try {
                const content = await zipContent.files[textFile].async('string');
                const simpleFilename = textFile.split('/').pop() || textFile;
                textFolderFiles.set(simpleFilename, content);
              } catch (error) {
                logInfo(`Failed to process ${textFile}: ${error}`);
              }
            }
            
            if (textFolderFiles.size > 0) {
              extractedFolders.push({
                folderName: 'text_files',
                files: textFolderFiles
              });
            }
          }
        } catch (e) {
          logInfo(`Error examining sample file: ${e}`);
        }
      }
      
      if (extractedFolders.length === 0) {
        if (nestedZipFiles.length > 0) {
          onError(`No .asc files found in the main ZIP or nested ZIP files. Please ensure your ZIP contains .asc files.`);
        } else {
          onError('No .asc files found in the ZIP file. Please ensure your ZIP contains .asc files or check subdirectories.');
        }
        return fileContents;
      }
    }
    
    // Combine files from all folders into a single map for backward compatibility
    for (const folder of extractedFolders) {
      for (const [filename, content] of folder.files.entries()) {
        const prefixedFilename = `${folder.folderName}/${filename}`;
        fileContents.set(prefixedFilename, content);
      }
    }
    
    onProgress(100);
    logInfo(`Total extracted ASC files: ${fileContents.size} from ${extractedFolders.length} folders`);
    
    return fileContents;
  } catch (error) {
    onError('Error extracting ZIP file: ' + (error instanceof Error ? error.message : String(error)));
    console.error('Error extracting ZIP:', error);
    return fileContents;
  }
}; 