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
    '556', '557', '558'
  ];
  
  try {
    // Process each file
    for (const [filename, content] of fileContents.entries()) {
      // Skip empty files
      if (!content.trim()) {
        console.warn(`File ${filename} is empty.`);
        continue;
      }
      
      // Parse CSV with pipe delimiter
      const parseResult = Papa.parse<AscRow>(content, {
        delimiter: '|',
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        transform: (value) => value.trim()
      });
      
      // Check for parse errors
      if (parseResult.errors && parseResult.errors.length > 0) {
        console.warn(`Parse errors in file ${filename}:`, parseResult.errors);
      }
      
      // Get the parsed data
      const rows = parseResult.data || [];
      
      if (rows.length === 0) {
        console.warn(`File ${filename} contains no valid data rows.`);
        continue;
      }
      
      // Check if we have a section code column
      const headers = Object.keys(rows[0]);
      const sectionCodeHeader = headers.find(
        header => header.toLowerCase() === 'section' || 
                 header.toLowerCase() === 'sectioncode' || 
                 header.toLowerCase() === 'section_code' ||
                 header.toLowerCase() === 'code'
      );
      
      if (!sectionCodeHeader) {
        return {
          sectionMap,
          error: `File ${filename} doesn't have a section code column. Expected headers: 'section', 'sectioncode', 'section_code', or 'code'.`
        };
      }
      
      // Process each row
      for (const row of rows) {
        const sectionCode = row[sectionCodeHeader];
        
        // Skip if not a valid section code
        if (!validSectionCodes.includes(sectionCode)) {
          console.warn(`Unknown section code "${sectionCode}" in file ${filename}. Skipping.`);
          continue;
        }
        
        // Add row to section map
        if (!sectionMap.has(sectionCode)) {
          sectionMap.set(sectionCode, []);
        }
        sectionMap.get(sectionCode)!.push(row);
      }
    }
    
    return { sectionMap };
  } catch (error) {
    return {
      sectionMap,
      error: 'Error parsing ASC files: ' + (error instanceof Error ? error.message : String(error))
    };
  }
}; 