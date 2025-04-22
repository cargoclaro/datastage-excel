import { useState, useEffect } from 'react'
import './App.css'
import DropZone from './components/DropZone'
import { extractAscFromZip } from './utils/zipHandler'
import { parseAscFilesFromFolders } from './utils/parser'
import { generateExcel, downloadExcel } from './utils/excel'
import logoImage from './assets/Transparent_image_no_bg.png'

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
    setDebugInfo([`Procesando archivo: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`])
    setShowDebug(false)

    try {
      // Extract ASC files from ZIP
      setProcessingInfo([`Extrayendo archivos ASC de ${file.name}...`])
      addDebugInfo("Iniciando extracción ZIP...");
      
      const fileContents = await extractAscFromZip(file, {
        onProgress: (percent) => setProgress(percent),
        onError: (errorMsg) => {
          setError(errorMsg);
          addDebugInfo(`Error de extracción ZIP: ${errorMsg}`);
        },
        onInfo: (info) => {
          addDebugInfo(info);
        }
      })

      // Update info about extracted files
      const fileCount = fileContents.size
      addDebugInfo(`Extraídos ${fileCount} archivos del ZIP`);
      
      if (fileCount === 0) {
        addDebugInfo("No se extrajo ningún archivo. Mostrando panel de depuración automáticamente.");
        setShowDebug(true);
        setError("No se pudieron extraer archivos ASC del archivo ZIP. Los archivos ASC pueden estar en una estructura de subcarpetas. Consulte la información de depuración para obtener más detalles.");
        setIsProcessing(false);
        return;
      }
      
      setProcessingInfo(prev => [...prev, `Se encontraron ${fileCount} archivos ASC en el archivo ZIP.`])

      // Parse ASC files
      setProcessingInfo(prev => [...prev, 'Analizando archivos ASC y organizando por código de sección...'])
      addDebugInfo("Iniciando análisis ASC...");
      
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
      addDebugInfo(`Se encontraron ${sectionCodes.length} códigos de sección diferentes`);
      
      const sectionSummary = sectionCodes.map(code => {
        const count = sectionMap.get(code)?.length || 0
        addDebugInfo(`Sección ${code}: ${count} filas`);
        return `Sección ${code}: ${count} filas`
      })

      setProcessingInfo(prev => [
        ...prev, 
        `Datos analizados organizados en ${sectionCodes.length} códigos de sección:`,
        ...sectionSummary
      ])

      if (sectionMap.size === 0) {
        setError('No se encontraron datos válidos en los archivos ASC.')
        addDebugInfo("No se encontraron secciones en los datos analizados");
        setIsProcessing(false)
        return
      }

      // Generate Excel file
      setProcessingInfo(prev => [...prev, 'Generando archivo Excel...'])
      addDebugInfo("Iniciando generación de Excel...");
      
      const fileName = file.name.replace(/\.(zip|ZIP)$/, '')
      const excelBlob = generateExcel(sectionMap)
      
      // Download the Excel file
      setProcessingInfo(prev => [...prev, 'Preparando descarga...'])
      addDebugInfo("Iniciando descarga...");
      
      downloadExcel(excelBlob, fileName)
      
      setSuccessMessage(`El archivo Excel "${fileName}.xlsx" ha sido creado con ${sectionCodes.length} hojas.`)
      addDebugInfo("Proceso completado exitosamente");
      setProgress(100)
    } catch (err) {
      const errorMessage = 'Error al procesar el archivo: ' + (err instanceof Error ? err.message : String(err));
      setError(errorMessage)
      addDebugInfo(`Error inesperado: ${errorMessage}`);
      console.error("Error de proceso:", err);
      setShowDebug(true);
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="app-container">
      <header>
        <div className="app-logo">
          <img src={logoImage} alt="Logo" />
        </div>
        <h1>Convertidor Datastage a Excel</h1>
        <p>Convierte fácilmente tus archivos ZIP con datos ASC en hojas de Excel organizadas</p>
      </header>

      <main>
        <div className="app-card">
          <h2 className="section-title">Sube tu archivo</h2>
          <DropZone 
            onFileAccepted={handleFileAccepted}
            progress={progress}
            isProcessing={isProcessing}
          />
          
          {processingInfo.length > 0 && isProcessing && (
            <div className="processing-info">
              <h3 className="info-title">Estado del procesamiento</h3>
              {processingInfo.map((info: string, index: number) => (
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
                  {showDebug ? 'Ocultar información de depuración' : 'Mostrar información de depuración'}
                </button>
              )}
            </div>
          )}
          
          {error && debugInfo.length > 0 && showDebug && (
            <div id="debug-info" className="debug-info">
              <h3>Información de depuración</h3>
              <pre>
                {debugInfo.map((info: string, index: number) => (
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

        <div className="app-card">
          <div className="file-tips">
            <p><strong>Consejo:</strong> La aplicación ahora admite tanto archivos directos como estructuras de carpetas anidadas en tus archivos ZIP.</p>
            <div className="structure">
              <div className="good">
                <h4>✅ Estructuras soportadas:</h4>
                <pre>
                  mis-datos.zip
                  ├── archivo1.asc
                  ├── archivo2.asc
                  └── archivo3.asc
                </pre>
                <pre>
                  mis-datos.zip
                  └── carpeta/
                      ├── archivo1.asc
                      └── archivo2.asc
                </pre>
                <pre>
                  mis-datos.zip
                  ├── carpeta1/
                  │   ├── archivo1.asc
                  │   └── archivo2.asc
                  └── carpeta2/
                      ├── archivo1.asc
                      └── archivo2.asc
                </pre>
              </div>
              <div className="good">
                <h4>✅ Beneficio de múltiples carpetas:</h4>
                <p>¡Los archivos con los mismos códigos de sección de diferentes carpetas se combinarán en la misma hoja de Excel!</p>
              </div>
            </div>
          </div>
        </div>

        <div className="app-card info-card">
          <h2 className="section-title">Cómo funciona</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Subir ZIP</h3>
                <p>Arrastra y suelta tu archivo ZIP que contiene archivos .asc</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Procesar datos</h3>
                <p>Extraemos y organizamos todos los datos por códigos de sección</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Descargar Excel</h3>
                <p>Obtén tu archivo Excel organizado con una hoja por sección</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer>
        <p>Convertidor de ZIP a Excel - Convierte tablas ASC a hojas de Excel organizadas por códigos de sección</p>
        <p className="copyright">© {new Date().getFullYear()} - Todo el procesamiento ocurre en tu navegador, tus datos nunca salen de tu computadora</p>
      </footer>
    </div>
  )
}

export default App
