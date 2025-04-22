import * as XLSX from 'xlsx';

// Section names mapping
const SECTION_NAMES: Record<string, string> = {
  '501': 'Section 501',
  '502': 'Section 502',
  '503': 'Section 503',
  '504': 'Section 504',
  '505': 'Section 505',
  '506': 'Section 506',
  '507': 'Section 507',
  '508': 'Section 508',
  '509': 'Section 509',
  '510': 'Section 510',
  '511': 'Section 511',
  '512': 'Section 512',
  '520': 'Section 520',
  '701': 'Section 701',
  '702': 'Section 702',
  '551': 'Section 551',
  '552': 'Section 552',
  '553': 'Section 553',
  '554': 'Section 554',
  '555': 'Section 555',
  '556': 'Section 556',
  '557': 'Section 557',
  '558': 'Section 558'
};

/**
 * Generate Excel file from parsed ASC data
 */
export const generateExcel = (
  sectionMap: Map<string, Array<Record<string, string>>>,
  fileName: string = 'merged_data'
): Blob => {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();
  
  // Process each section
  for (const [sectionCode, rows] of sectionMap.entries()) {
    if (rows.length === 0) {
      continue;
    }
    
    // Get sheet name
    const sheetName = SECTION_NAMES[sectionCode] || `Section ${sectionCode}`;
    
    // Get headers from the first row
    const headers = Object.keys(rows[0]);
    
    // Prepare data for the sheet
    const sheetData = [
      // Headers
      headers,
      // Data rows
      ...rows.map(row => headers.map(header => row[header] || ''))
    ];
    
    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }
  
  // Generate Excel file as an array buffer
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  
  // Convert to Blob
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  return blob;
};

/**
 * Download Excel file
 */
export const downloadExcel = (blob: Blob, fileName: string = 'merged_data'): void => {
  // Create a download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  // Set link properties
  link.href = url;
  link.download = `${fileName}.xlsx`;
  
  // Append to body, click, and remove
  document.body.appendChild(link);
  link.click();
  
  // Clean up
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}; 