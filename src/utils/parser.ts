import Papa from 'papaparse';

interface AscRow {
  [key: string]: string;
}

export interface ParsedData {
  sectionMap: Map<string, AscRow[]>;
  error?: string;
}

/**
 * Parse ASC file contents and group rows by section code
 */
export const parseAscFiles = (fileContents: Map<string, string>): ParsedData => {
  // Map to store rows by section code
  const sectionMap = new Map<string, AscRow[]>();
  
  // Valid section codes from the requirements
  const validSectionCodes = [
    '501', '502', '503', '504', '505', '506', '507', '508', '509', '510', 
    '511', '512', '520', '701', '702', '551', '552', '553', '554', '555', 
    '556', '557', '558', 
    // Add common section codes from example file if needed
    '160', '240', '430'
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
          transformHeader: (header) => header?.trim() || '',
          transform: (value) => value?.trim() || ''
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
              
              // Add row to section map
              if (!sectionMap.has(sectionCode)) {
                sectionMap.set(sectionCode, []);
              }
              sectionMap.get(sectionCode)?.push(row);
            }
          } else {
            console.warn(`File ${filename} doesn't have a recognized section code column. Using filename section if available.`);
          }
        } else {
          // Use the section code from the filename for all rows in this file
          if (!sectionMap.has(filenameSection)) {
            sectionMap.set(filenameSection, []);
          }
          // Add all rows to this section
          sectionMap.get(filenameSection)?.push(...rows);
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