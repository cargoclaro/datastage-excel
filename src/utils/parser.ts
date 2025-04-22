import Papa from 'papaparse';

interface AscRow {
  [key: string]: string;
}

export interface ParsedData {
  sectionMap: Map<string, AscRow[]>;
  error?: string;
}

/**
 * Parse ASC files from multiple folders and group rows by section code
 * All files from all folders with the same section code will be concatenated
 */
export const parseAscFilesFromFolders = (
  folderContents: Map<string, Map<string, string>>
): ParsedData => {
  // Create a combined map of all files from all folders
  const allFileContents = new Map<string, string>();
  
  // Process each folder's files
  for (const [folderName, fileContents] of folderContents.entries()) {
    for (const [filename, content] of fileContents.entries()) {
      // Use folder name as prefix to avoid filename conflicts
      const prefixedFilename = `${folderName}/${filename}`;
      allFileContents.set(prefixedFilename, content);
    }
  }
  
  // Use the existing parser function to process all files
  return parseAscFiles(allFileContents);
};

/**
 * Create a combined identifier from multiple fields
 */
function createCombinedIdentifier(row: AscRow): string {
  try {
    // Extract year from FechaPagoReal field which has format "2025-03-05 11:58:12"
    let year = '';
    const fechaPagoReal = row['FechaPagoReal'] || row['fechaPagoReal'] || row['FECHA_PAGO_REAL'];
    
    if (fechaPagoReal) {
      // The date format is "YYYY-MM-DD HH:MM:SS"
      // Extract the first 4 characters which will be the year
      if (fechaPagoReal.length >= 4) {
        // Get just the last two digits of the year
        year = fechaPagoReal.substring(2, 4);
      }
    }
    
    // If no year found, use empty string
    if (!year) {
      console.warn('Could not extract year from FechaPagoReal field');
      year = '';
    }
    
    // Get seccion aduanera (might be under different field names)
    let seccion = '';
    const seccionFields = ['seccionAduanera', 'seccion', 'aduana', 'SECCION', 'ADUANA', 'SECCION_ADUANERA', 'ClaveDoc', 'SeccionAd'];
    for (const field of seccionFields) {
      if (row[field]) {
        seccion = row[field].trim();
        break;
      }
    }
    
    // Get patente (might be under different field names)
    let patente = '';
    const patenteFields = ['patente', 'PATENTE', 'Patente'];
    for (const field of patenteFields) {
      if (row[field]) {
        patente = row[field].trim();
        break;
      }
    }
    
    // Get pedimento (might be under different field names)
    let pedimento = '';
    const pedimentoFields = ['pedimento', 'PEDIMENTO', 'Pedimento', 'numeroPedimento', 'pedimentoNumero', 'Pediment'];
    for (const field of pedimentoFields) {
      if (row[field]) {
        pedimento = row[field].trim();
        break;
      }
    }
    
    // Create array of non-empty values
    const parts = [];
    if (year) parts.push(year);
    if (seccion) parts.push(seccion);
    if (patente) parts.push(patente);
    if (pedimento) parts.push(pedimento);
    
    // Join with single dashes
    return parts.join('-');
  } catch (error) {
    console.warn('Error creating combined identifier:', error);
    return 'ID-Unknown';
  }
}

/**
 * Parse ASC file contents and group rows by section code
 */
export const parseAscFiles = (fileContents: Map<string, string>): ParsedData => {
  // Map to store rows by section code
  const sectionMap = new Map<string, AscRow[]>();
  
  // Valid section codes from the requirements, in the specified order
  const validSectionCodes = [
    // Tablas con información a nivel de pedimento
    '501', '502', '503', '504', '505', '506', '507', '508', '509', '510', 
    '511', '512', '520', '701', '702',
    // Tablas con información a nivel de partida (Secuencia de la fracción arancelaria)
    '551', '552', '553', '554', '555', '556', '557', '558',

  ];
  
  // Possible section code column names to check
  const possibleSectionColumns = [
    'section', 'sectioncode', 'section_code', 'code',
    'seccion', 'seccionaduanera', 'seccion_aduanera'
  ];
  
  try {
    // Process each file
    for (const [filename, content] of fileContents.entries()) {
      // Skip empty files
      if (!content || !content.trim()) {
        console.warn(`File ${filename} is empty.`);
        continue;
      }
      
      // Extract section code from filename if possible (pattern: *_XXX.asc)
      let filenameSection = null;
      const sectionMatch = filename.match(/_(\d{3})\.(asc|ASC)$/);
      if (sectionMatch && sectionMatch[1]) {
        filenameSection = sectionMatch[1];
        console.log(`Extracted section code ${filenameSection} from filename ${filename}`);
      }
      
      // Clean up content - remove trailing pipes at end of lines
      const cleanContent = content
        .split('\n')
        .map(line => line.endsWith('|') ? line.slice(0, -1) : line)
        .join('\n');
      
      try {
        // Parse CSV with pipe delimiter
        const parseResult = Papa.parse(cleanContent, {
          delimiter: '|',
          header: true,
          skipEmptyLines: true,
          transformHeader: (header: string) => header?.trim() || '',
          transform: (value: string) => value?.trim() || ''
        });
        
        // Check for parse errors
        if (parseResult.errors && parseResult.errors.length > 0) {
          console.warn(`Parse errors in file ${filename}:`, parseResult.errors);
        }
        
        // Get the parsed data
        const rows = parseResult.data as AscRow[] || [];
        
        if (!rows || rows.length === 0) {
          // If we have a section code from filename but no rows, create an empty array for that section
          if (filenameSection && validSectionCodes.includes(filenameSection)) {
            if (!sectionMap.has(filenameSection)) {
              sectionMap.set(filenameSection, []);
            }
            console.log(`Created empty section ${filenameSection} from file ${filename}`);
          } else {
            console.warn(`File ${filename} contains no valid data rows.`);
          }
          continue;
        }
        
        // Find the section code column if we don't have one from filename
        if (!filenameSection) {
          if (!rows[0]) {
            console.warn(`No data rows in file ${filename}`);
            continue;
          }
          
          const headers = Object.keys(rows[0]);
          
          // Try to find section column by matching known names (case insensitive)
          const sectionCodeHeader = headers.find(
            header => header && possibleSectionColumns.includes(header.toLowerCase())
          );
          
          if (sectionCodeHeader) {
            // Process rows using column data
            for (const row of rows) {
              if (!row) continue;
              
              const sectionCode = row[sectionCodeHeader];
              
              // Skip if section code is missing
              if (!sectionCode) {
                console.warn(`Missing section code in file ${filename}. Skipping row.`);
                continue;
              }
              
              // Use section code even if not in valid list (log warning but include data)
              if (!validSectionCodes.includes(sectionCode)) {
                console.warn(`Uncommon section code "${sectionCode}" in file ${filename}. Including anyway.`);
              }
              
              // Create combined identifier and add it as first field in row
              const combinedId = createCombinedIdentifier(row);
              const enhancedRow: AscRow = { 
                "No_Pedimento": combinedId,
                ...row
              };

              // Add row to section map
              if (!sectionMap.has(sectionCode)) {
                sectionMap.set(sectionCode, []);
              }
              sectionMap.get(sectionCode)?.push(enhancedRow);
            }
          } else {
            console.warn(`File ${filename} doesn't have a recognized section code column. Using filename section if available.`);
          }
        } else {
          // Use the section code from the filename for all rows in this file
          if (!sectionMap.has(filenameSection)) {
            sectionMap.set(filenameSection, []);
          }
          
          // Add combined identifier to each row and add it to the section
          const enhancedRows = rows.map(row => {
            const combinedId = createCombinedIdentifier(row);
            return {
              "No_Pedimento": combinedId,
              ...row
            };
          });
          
          // Add all rows to this section
          sectionMap.get(filenameSection)?.push(...enhancedRows);
        }
      } catch (parseError) {
        console.error(`Error parsing file ${filename}:`, parseError);
      }
    }
    
    if (sectionMap.size === 0) {
      return {
        sectionMap,
        error: 'No valid data found in any of the files.'
      };
    }
    
    return { sectionMap };
  } catch (error) {
    console.error('Error in parseAscFiles:', error);
    return {
      sectionMap,
      error: 'Error parsing ASC files: ' + (error instanceof Error ? error.message : String(error))
    };
  }
}; 