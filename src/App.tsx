import { useState, useEffect } from 'react'
import './App.css'
import DropZone from './components/DropZone'
import { extractAscFromZip } from './utils/zipHandler'
import { parseAscFiles, parseAscFilesFromFolders } from './utils/parser'
import { generateExcel, downloadExcel } from './utils/excel'

function App() {
  const [progress, setProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [processingInfo, setProcessingInfo] = useState<string[]>([])
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [showDebug, setShowDebug] = useState(false)

  // Log errors to console for debugging
  useEffect(() => {
    if (error) {
      console.error("Application error:", error);
    }
  }, [error]);

  const addDebugInfo = (message: string) => {
    console.log(message);
    setDebugInfo(prev => [...prev, message]);
  };

  const handleFileAccepted = async (file: File) => {
    setIsProcessing(true)
    setProgress(0)
    setError(null)
    setSuccessMessage(null)
    setProcessingInfo([])
    setDebugInfo([`Processing file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`])
    setShowDebug(false)

    try {
      // Extract ASC files from ZIP
      setProcessingInfo([`Extracting ASC files from ${file.name}...`])
      addDebugInfo("Starting ZIP extraction...");
      
      const fileContents = await extractAscFromZip(file, {
        onProgress: (percent) => setProgress(percent),
        onError: (errorMsg) => {
          setError(errorMsg);
          addDebugInfo(`ZIP extraction error: ${errorMsg}`);
        },
        onInfo: (info) => {
          addDebugInfo(info);
        }
      })

      // Update info about extracted files
      const fileCount = fileContents.size
      addDebugInfo(`Extracted ${fileCount} files from ZIP`);
      
      if (fileCount === 0) {
        addDebugInfo("No files were extracted. Showing debug panel automatically.");
        setShowDebug(true);
        setError("No ASC files could be extracted from the ZIP file. The ASC files may be in a subfolder structure. Check the debug information for details.");
        setIsProcessing(false);
        return;
      }
      
      setProcessingInfo(prev => [...prev, `Found ${fileCount} ASC files in the ZIP archive.`])

      // Parse ASC files
      setProcessingInfo(prev => [...prev, 'Parsing ASC files and organizing by section code...'])
      addDebugInfo("Starting ASC parsing...");
      
      // Create a map of folder to files
      const folderMap = new Map<string, Map<string, string>>();
      
      // Group files by folder
      for (const [path, content] of fileContents.entries()) {
        // Split path into folder and filename
        const parts = path.split('/');
        const folderName = parts.length > 1 ? parts[0] : 'main';
        const fileName = parts.length > 1 ? parts.slice(1).join('/') : path;
        
        // Initialize folder map if it doesn't exist
        if (!folderMap.has(folderName)) {
          folderMap.set(folderName, new Map<string, string>());
        }
        
        // Add file to folder map
        folderMap.get(folderName)?.set(fileName, content);
      }
      
      addDebugInfo(`Organized files into ${folderMap.size} folders: ${Array.from(folderMap.keys()).join(', ')}`);
      
      // Use the new function to parse files from multiple folders
      const { sectionMap, error: parseError } = parseAscFilesFromFolders(folderMap);
      
      if (parseError) {
        setError(parseError)
        addDebugInfo(`Parse error: ${parseError}`);
        setIsProcessing(false)
        return
      }

      // Show info about section codes
      const sectionCodes = Array.from(sectionMap.keys()).sort()
      addDebugInfo(`Found ${sectionCodes.length} different section codes`);
      
      const sectionSummary = sectionCodes.map(code => {
        const count = sectionMap.get(code)?.length || 0
        addDebugInfo(`Section ${code}: ${count} rows`);
        return `Section ${code}: ${count} rows`
      })

      setProcessingInfo(prev => [
        ...prev, 
        `Parsed data organized into ${sectionCodes.length} section codes:`,
        ...sectionSummary
      ])

      if (sectionMap.size === 0) {
        setError('No valid data found in the ASC files.')
        addDebugInfo("No sections found in parsed data");
        setIsProcessing(false)
        return
      }

      // Generate Excel file
      setProcessingInfo(prev => [...prev, 'Generating Excel file...'])
      addDebugInfo("Starting Excel generation...");
      
      const fileName = file.name.replace(/\.(zip|ZIP)$/, '')
      const excelBlob = generateExcel(sectionMap, fileName)
      
      // Download the Excel file
      setProcessingInfo(prev => [...prev, 'Preparing download...'])
      addDebugInfo("Initiating download...");
      
      downloadExcel(excelBlob, fileName)
      
      setSuccessMessage(`Excel file "${fileName}.xlsx" has been created with ${sectionCodes.length} sheets.`)
      addDebugInfo("Process completed successfully");
      setProgress(100)
    } catch (err) {
      const errorMessage = 'Error processing file: ' + (err instanceof Error ? err.message : String(err));
      setError(errorMessage)
      addDebugInfo(`Unexpected error: ${errorMessage}`);
      console.error("Process error:", err);
      setShowDebug(true);
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="app-container">
      <header>
        <div className="app-logo">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path>
            <line x1="16" y1="8" x2="2" y2="22"></line>
            <line x1="17.5" y1="15" x2="9" y2="15"></line>
          </svg>
        </div>
        <h1>ZIP to Excel Converter</h1>
        <p>Easily convert your ZIP files containing ASC data into organized Excel sheets</p>
      </header>

      <main>
        <div className="app-card">
          <h2 className="section-title">Upload Your File</h2>
          <div className="file-tips">
            <p><strong>Tip:</strong> The app now supports both direct files and nested folder structures in your ZIP files.</p>
            <div className="structure">
              <div className="good">
                <h4>✅ Supported Structures:</h4>
                <pre>
                  my-data.zip
                  ├── file1.asc
                  ├── file2.asc
                  └── file3.asc
                </pre>
                <pre>
                  my-data.zip
                  └── folder/
                      ├── file1.asc
                      └── file2.asc
                </pre>
                <pre>
                  my-data.zip
                  ├── folder1/
                  │   ├── file1.asc
                  │   └── file2.asc
                  └── folder2/
                      ├── file1.asc
                      └── file2.asc
                </pre>
              </div>
              <div className="good">
                <h4>✅ Multiple Folders Benefit:</h4>
                <p>Files with the same section codes from different folders will be combined into the same Excel sheet!</p>
              </div>
            </div>
          </div>
          <DropZone 
            onFileAccepted={handleFileAccepted}
            progress={progress}
            isProcessing={isProcessing}
          />
          
          {processingInfo.length > 0 && isProcessing && (
            <div className="processing-info">
              <h3 className="info-title">Processing Status</h3>
              {processingInfo.map((info, index) => (
                <p key={index}>{info}</p>
              ))}
            </div>
          )}
          
          {error && (
            <div className="error-message">
              <p>{error}</p>
              {debugInfo.length > 0 && (
                <button 
                  className="debug-toggle"
                  onClick={() => setShowDebug(!showDebug)}
                >
                  {showDebug ? 'Hide Debugging Info' : 'Show Debugging Info'}
                </button>
              )}
            </div>
          )}
          
          {error && debugInfo.length > 0 && showDebug && (
            <div id="debug-info" className="debug-info">
              <h3>Debugging Information</h3>
              <pre>
                {debugInfo.map((info, index) => (
                  <div key={index}>{info}</div>
                ))}
              </pre>
            </div>
          )}
          
          {successMessage && (
            <div className="success-message">
              <p>{successMessage}</p>
            </div>
          )}
        </div>

        <div className="app-card info-card">
          <h2 className="section-title">How It Works</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Upload ZIP</h3>
                <p>Drag and drop your ZIP file containing .asc files</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Process Data</h3>
                <p>We extract and organize all data by section codes</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Download Excel</h3>
                <p>Get your organized Excel file with one sheet per section</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer>
        <p>ZIP to Excel Converter - Converts ASC tables to Excel sheets organized by section codes</p>
        <p className="copyright">© {new Date().getFullYear()} - All processing happens in your browser, your data never leaves your computer</p>
      </footer>
    </div>
  )
}

export default App
