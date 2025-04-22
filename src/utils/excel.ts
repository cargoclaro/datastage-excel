import * as XLSX from 'xlsx';

// Custom order for sections (exact order specified by user)
const SECTION_ORDER = [
  // Tablas con información a nivel de pedimento
  '501', '502', '503', '504', '505',
  '506', '507', '508', '509', '510',
  '511', '512', '520', '701', '702',
  // Tablas con información a nivel de partida
  '551', '552', '553', '554', '555',
  '556', '557', '558',
  // Other common codes
  '160', '240', '430'
];

// Section names mapping with more descriptive names
const SECTION_NAMES: Record<string, string> = {
  // Tablas con información a nivel de pedimento
  '501': 'Datos generales',
  '502': 'Transporte de las mercancías',
  '503': 'Guías',
  '504': 'Contenedores',
  '505': 'Facturas',
  '506': 'Fechas del pedimento',
  '507': 'Casos del pedimento',
  '508': 'Cuentas aduaneras de garantía',
  '509': 'Tasas del pedimento',
  '510': 'Contribuciones del pedimento',
  '511': 'Observaciones del pedimento',
  '512': 'Descargos de mercancías',
  '520': 'Destinatarios de la mercancía',
  '701': 'Rectificaciones',
  '702': 'Diferencias de contribuciones',
  // Tablas con información a nivel de partida
  '551': 'Partidas',
  '552': 'Mercancías',
  '553': 'Permiso de la partida',
  '554': 'Casos de la partida',
  '555': 'Cuentas aduaneras (partida)',
  '556': 'Tasas de contribuciones (partida)',
  '557': 'Contribuciones de la partida',
  '558': 'Observaciones de la partida',
  // Other common codes
  '160': 'Sección 160',
  '240': 'Sección 240',
  '430': 'Sección 430'
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
 * Get formatted sheet name with section code prefix
 */
function getFormattedSheetName(sectionCode: string): string {
  const sectionName = SECTION_NAMES[sectionCode] || `Section ${sectionCode}`;
  return `${sectionCode} ${sectionName}`;
}

/**
 * Calculate the width of a string in Excel character units
 * This is an approximation as actual width depends on font and characters
 */
function calculateColumnWidth(str: string): number {
  if (!str) return 8; // Minimum column width
  
  // Base width - proportional to string length but with some adjustments
  // Extra width for wider characters, less for narrow ones
  let width = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charAt(i);
    // Wide characters (CJK, symbols, etc.) get more width
    if (/[ÑñÁáÉéÍíÓóÚúÜü]/.test(char)) {
      width += 2.2; // Extra width for accented characters
    } else if (/[W]/.test(char)) {
      width += 1.5; // Wider letters
    } else if (/[ilI1]/.test(char)) {
      width += 0.6; // Narrow letters
    } else if (/[0-9]/.test(char)) {
      width += 1.2; // Numbers
    } else {
      width += 1.1; // Normal letters
    }
  }
  
  // Minimum 6 characters, maximum 50 characters (Excel limits)
  return Math.max(8, Math.min(50, width));
}

/**
 * Auto-size columns based on header and content widths
 */
function autoSizeColumns(worksheet: XLSX.WorkSheet, headers: string[], data: string[][]): void {
  // Initialize column widths based on headers
  const colWidths: number[] = headers.map(header => calculateColumnWidth(header));
  
  // Check data to find maximum width needed for each column
  data.forEach(row => {
    row.forEach((cell, colIndex) => {
      if (colIndex < colWidths.length) {
        const cellWidth = calculateColumnWidth(String(cell));
        if (cellWidth > colWidths[colIndex]) {
          colWidths[colIndex] = cellWidth;
        }
      }
    });
  });
  
  // Set column widths in worksheet
  if (!worksheet['!cols']) {
    worksheet['!cols'] = [];
  }
  
  // Apply calculated widths
  colWidths.forEach((width, i) => {
    worksheet['!cols'][i] = { width };
  });
}

/**
 * Apply styling to the worksheet
 */
function applyWorksheetStyling(worksheet: XLSX.WorkSheet): void {
  // Make the header row bold and with a background color
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
  
  // Set properties for entire sheet
  if (!worksheet['!sheetFormat']) {
    worksheet['!sheetFormat'] = {};
  }
  
  // Enable filtering for header row
  if (range.e.r > 0) {
    worksheet['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(range.e.c)}1` };
  }
}

/**
 * Generate Excel file from parsed ASC data
 */
export const generateExcel = (
  sectionMap: Map<string, Array<Record<string, string>>>
): Blob => {
  try {
    // Create a new workbook
    const workbook = XLSX.utils.book_new();
    
    // Create a sorted list of section codes based on the predefined order
    const availableSections = Array.from(sectionMap.keys());
    const orderedSections: string[] = [];
    
    // First add sections in the predefined order if they exist
    for (const code of SECTION_ORDER) {
      if (sectionMap.has(code)) {
        orderedSections.push(code);
      }
    }
    
    // Then add any remaining sections that weren't in the predefined order
    for (const code of availableSections) {
      if (!orderedSections.includes(code)) {
        orderedSections.push(code);
      }
    }
    
    // Process each section in the ordered array
    for (const sectionCode of orderedSections) {
      try {
        const rows = sectionMap.get(sectionCode) || [];
        
        // Format and sanitize sheet name with section code prefix
        const sheetName = sanitizeSheetName(getFormattedSheetName(sectionCode));
        
        if (rows.length === 0) {
          // Create an empty sheet for sections with no data
          const worksheet = XLSX.utils.aoa_to_sheet([]);
          XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
          continue;
        }
        
        // Get headers from the first row
        const headers = Object.keys(rows[0] || {});
        
        if (headers.length === 0) {
          console.warn(`No headers found for section ${sectionCode}`);
          const worksheet = XLSX.utils.aoa_to_sheet([]);
          XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
          continue;
        }
        
        // Prepare data for the sheet
        const dataRows = rows.map(row => headers.map(header => row[header] || ''));
        const sheetData = [
          // Headers
          headers,
          // Data rows
          ...dataRows
        ];
        
        // Create worksheet
        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
        
        // Auto-size columns based on content
        autoSizeColumns(worksheet, headers, dataRows);
        
        // Apply styling (headers, etc.)
        applyWorksheetStyling(worksheet);
        
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