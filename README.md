# ZIP to Excel Converter

A client-side web application that converts ZIP archives containing `.asc` files to a single Excel file with data organized by section codes.

## Features

- Drag and drop ZIP file upload
- Client-side processing (no server required)
- Real-time progress bar
- Parses `.asc` tables (pipe-delimited format)
- Merges data by section code
- Generates `.xlsx` file with one sheet per section code
- Automatic download of the resulting Excel file
- Maximum file size: 50MB

## Supported Section Codes

The application supports the following section codes:
501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 520, 701, 702, 551, 552, 553, 554, 555, 556, 557, 558

## How to Use

1. Drag and drop a ZIP file containing `.asc` files into the drop zone
2. Wait for the application to process the files
3. The Excel file will be automatically downloaded when processing is complete

## Format Requirements

- `.asc` files should be pipe-delimited (|) tables
- Each table should have a header row
- One of the columns should be named 'section', 'sectioncode', 'section_code', or 'code'
- This column should contain one of the supported section codes

## Development

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/zip-to-excel.git
cd zip-to-excel

# Install dependencies
npm install

# Start development server
npm run dev
```

### Building for Production

```bash
npm run build
```

The build will be created in the `dist` directory.

### Technologies Used

- Vite (Build tool)
- React (UI library)
- TypeScript (Type safety)
- JSZip (Reading ZIP files)
- SheetJS (xlsx) (Excel file generation)
- React Dropzone (File upload)
- RC Progress (Progress bar)
