import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Line } from 'rc-progress';

interface DropZoneProps {
  onFileAccepted: (file: File) => void;
  progress: number;
  isProcessing: boolean;
}

const DropZone = ({ onFileAccepted, progress, isProcessing }: DropZoneProps) => {
  const [error, setError] = useState<string | null>(null);
  
  // Max file size: 50MB
  const MAX_SIZE = 50 * 1024 * 1024;
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    
    if (acceptedFiles.length === 0) {
      return;
    }
    
    const file = acceptedFiles[0];
    
    // Check file type
    if (!file.name.endsWith('.zip')) {
      setError('Please upload a ZIP file');
      return;
    }
    
    // Check file size
    if (file.size > MAX_SIZE) {
      setError(`File is too large. Maximum size is 50MB`);
      return;
    }
    
    onFileAccepted(file);
  }, [onFileAccepted]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip']
    },
    maxSize: MAX_SIZE,
    multiple: false
  });
  
  return (
    <div className="dropzone-container">
      <div 
        {...getRootProps()} 
        className={`dropzone ${isDragActive ? 'active' : ''} ${isProcessing ? 'processing' : ''}`}
      >
        <input {...getInputProps()} />
        
        {isProcessing ? (
          <div className="processing-container">
            <h2>Processing ZIP file...</h2>
            <Line percent={progress} strokeWidth={2} strokeColor="#4caf50" />
            <p>{Math.round(progress)}%</p>
          </div>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <h2>Drag & Drop ZIP File Here</h2>
            <p>or click to browse files</p>
            <p className="file-limit">(Max file size: 50MB)</p>
            
            {error && <p className="error-message">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default DropZone; 