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
  '558': 'Section 558',
  '160': 'Seccion 160',
  '240': 'Seccion 240',
  '430': 'Seccion 430'
};

/**
 * Sanitize sheet name to comply with Excel limitations
 * Excel has a 31 character limit for sheet names and doesn't allow certain characters
 */
function sanitizeSheetName(name: string): string {
  // Truncate to 31 characters max (Excel limitation)
  let sanitized = name.substring(0, 31);
  
  // Replace illegal characters
  sanitized = sanitized.replace(/[\[\]\*\?\/\\\:]/g, '_');
  
  return sanitized;
}

/**
 * Generate Excel file from parsed ASC data
 */
export const generateExcel = (
  sectionMap: Map<string, Array<Record<string, string>>>,
  fileName: string = 'merged_data'
): Blob => {
  try {
    // Create a new workbook
    const workbook = XLSX.utils.book_new();
    
    // Get all section codes and sort them numerically
    const sectionCodes = Array.from(sectionMap.keys()).sort((a, b) => {
      const numA = parseInt(a, 10) || 0;
      const numB = parseInt(b, 10) || 0;
      return numA - numB;
    });
    
    // Process each section in sorted order
    for (const sectionCode of sectionCodes) {
      try {
        const rows = sectionMap.get(sectionCode) || [];
        
        if (rows.length === 0) {
          // Create an empty sheet for sections with no data
          const worksheet = XLSX.utils.aoa_to_sheet([]);
          const safeName = sanitizeSheetName(SECTION_NAMES[sectionCode] || `Section ${sectionCode}`);
          XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
          continue;
        }
        
        // Get sheet name
        const sheetName = sanitizeSheetName(SECTION_NAMES[sectionCode] || `Section ${sectionCode}`);
        
        // Get headers from the first row
        const headers = Object.keys(rows[0] || {});
        
        if (headers.length === 0) {
          console.warn(`No headers found for section ${sectionCode}`);
          const worksheet = XLSX.utils.aoa_to_sheet([]);
          XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
          continue;
        }
        
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
      } catch (sheetError) {
        console.error(`Error creating sheet for section ${sectionCode}:`, sheetError);
        // Create an error sheet
        const errorWorksheet = XLSX.utils.aoa_to_sheet([
          ["Error processing this section"],
          [String(sheetError)]
        ]);
        const errorSheetName = sanitizeSheetName(`Error_${sectionCode}`);
        XLSX.utils.book_append_sheet(workbook, errorWorksheet, errorSheetName);
      }
    }
    
    // Generate Excel file as an array buffer
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    
    // Convert to Blob
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    return blob;
  } catch (error) {
    console.error("Error generating Excel file:", error);
    // Create a simple error workbook
    const workbook = XLSX.utils.book_new();
    const errorWorksheet = XLSX.utils.aoa_to_sheet([
      ["Error creating Excel file"],
      [String(error)]
    ]);
    XLSX.utils.book_append_sheet(workbook, errorWorksheet, "Error");
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }
};

/**
 * Download Excel file
 */
export const downloadExcel = (blob: Blob, fileName: string = 'merged_data'): void => {
  try {
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
  } catch (error) {
    console.error("Error downloading Excel file:", error);
    alert("There was an error downloading the file. Please check the console for details.");
  }
}; 