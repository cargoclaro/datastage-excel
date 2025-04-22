import { useState } from 'react'
import './App.css'
import DropZone from './components/DropZone'
import { extractAscFromZip } from './utils/zipHandler'
import { parseAscFiles } from './utils/parser'
import { generateExcel, downloadExcel } from './utils/excel'

function App() {
  const [progress, setProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleFileAccepted = async (file: File) => {
    setIsProcessing(true)
    setProgress(0)
    setError(null)
    setSuccessMessage(null)

    try {
      // Extract ASC files from ZIP
      const fileContents = await extractAscFromZip(file, {
        onProgress: (percent) => setProgress(percent),
        onError: (errorMsg) => setError(errorMsg)
      })

      // Parse ASC files
      const { sectionMap, error: parseError } = parseAscFiles(fileContents)
      
      if (parseError) {
        setError(parseError)
        setIsProcessing(false)
        return
      }

      if (sectionMap.size === 0) {
        setError('No valid data found in the ASC files.')
        setIsProcessing(false)
        return
      }

      // Generate Excel file
      const fileName = file.name.replace('.zip', '')
      const excelBlob = generateExcel(sectionMap, fileName)
      
      // Download the Excel file
      downloadExcel(excelBlob, fileName)
      
      setSuccessMessage(`Excel file "${fileName}.xlsx" has been created.`)
      setProgress(100)
    } catch (err) {
      setError('Error processing file: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="app-container">
      <header>
        <h1>ZIP to Excel Converter</h1>
        <p>Drag & drop a ZIP file containing ASC files to convert to Excel</p>
      </header>

      <main>
        <DropZone 
          onFileAccepted={handleFileAccepted}
          progress={progress}
          isProcessing={isProcessing}
        />
        
        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}
        
        {successMessage && (
          <div className="success-message">
            <p>{successMessage}</p>
          </div>
        )}
      </main>

      <footer>
        <p>Converts ASC tables to Excel sheets organized by section codes</p>
      </footer>
    </div>
  )
}

export default App
