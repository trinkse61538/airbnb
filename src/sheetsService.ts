import { SheetReport, LowItem } from './types';

/**
 * Extract Spreadsheet ID from a shared Google Sheets URL or return the raw string if it's already an ID.
 */
export function extractSpreadsheetId(urlOrId: string): string {
  const trimmed = urlOrId.trim();
  if (!trimmed) return '';
  
  // URL looks like: https://docs.google.com/spreadsheets/d/1trCnssQ907GIDO1slhaW0RGcJaSWKXSCkScZP31r5SE/edit#gid=838351553
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Fetch spreadsheet metadata to get the spreadsheet title
 */
export async function fetchSpreadsheetTitle(
  spreadsheetId: string,
  accessToken: string
): Promise<string> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=properties.title`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    
    const data = await res.json();
    return data?.properties?.title || 'Google Sheets Spreadsheet';
  } catch (error: any) {
    console.error('Error fetching spreadsheet details:', error);
    throw new Error(error?.message || 'Unable to retrieve spreadsheet title');
  }
}

/**
 * Fetch data for all sheet tabs and analyze inventory levels
 */
export async function fetchSpreadsheetReports(
  spreadsheetId: string,
  accessToken: string,
  shortageTerms: string[] = ['low', 'empty', 'shortage', 'out', '0']
): Promise<SheetReport[]> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const normalizedShortageTerms = shortageTerms.map(t => t.trim().toLowerCase()).filter(Boolean);

  try {
    // 1. Fetch spreadsheet schema (get names of all sheets)
    const metadataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=sheets.properties.title`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!metadataRes.ok) {
      const err = await metadataRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Unable to access spreadsheet (HTTP ${metadataRes.status})`);
    }

    const metadata = await metadataRes.json();
    const sheetTitles: string[] = (metadata?.sheets || [])
      .map((s: any) => s?.properties?.title)
      .filter(Boolean);

    if (sheetTitles.length === 0) {
      throw new Error('Spreadsheet does not contain any sheets (tabs).');
    }

    const reports: SheetReport[] = [];

    // 2. Map through all sheets and fetch values (run them in concurrent batches to prevent API rate limiting while maintaining speed)
    const fetchPromises = sheetTitles.map(async (sheetTitle) => {
      try {
        const quotedTitle = `'${sheetTitle.replace(/'/g, "''")}'`;
        const encodedTitle = encodeURIComponent(quotedTitle);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodedTitle}?valueRenderOption=FORMATTED_VALUE`;
        
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) {
          console.warn(`Error fetching data for sheet ${sheetTitle}:`, res.status);
          return null; // Return null, will be filtered out or handled elegantly
        }

        const data = await res.json();
        const values: string[][] = data?.values || [];
        
        if (values.length === 0) {
          // Empty tab
          return {
            sheetName: sheetTitle,
            lastRowIndex: 0,
            headers: [],
            values: [],
            lowItems: [],
            hasLowStock: false,
          };
        }

        // Item names/headers are at Row 3 (index 2 in 0-based indexing) as requested, with standard fallback if fewer rows exist
        let headers: string[] = [];
        let headerRowIndex = 0;

        if (values.length >= 3) {
          headers = values[2].map(h => String(h || '').trim());
          headerRowIndex = 2; // Row 3
        } else if (values.length > 0) {
          headers = values[0].map(h => String(h || '').trim());
          headerRowIndex = 0; // Row 1 fallback
        }

        // Find the last row containing any data (skipping the header row and everything before it)
        let lastRowIndex = -1;
        let lastRowCells: string[] = [];

        for (let r = values.length - 1; r > headerRowIndex; r--) {
          const row = values[r];
          // Check if row has at least one cell with content
          if (row && row.some(cell => cell && String(cell).trim() !== '')) {
            lastRowIndex = r;
            // Pad the row values to match the header length so we don't index out of bounds
            lastRowCells = headers.map((_, i) => String(row[i] || '').trim());
            break;
          }
        }

        const lowItems: LowItem[] = [];

        if (lastRowIndex !== -1) {
          // Check cells in this last row
          lastRowCells.forEach((cellVal, colIdx) => {
            const headerName = headers[colIdx];
            if (!headerName) return; // Skip columns without a header name

            const normalizedVal = cellVal.toLowerCase();
            
            // If the cell contains a term like "low" or "empty"
            const isMatch = normalizedShortageTerms.some(term => {
              if (term === '0' || term === 'empty' || term === 'out') {
                return normalizedVal === term;
              }
              return normalizedVal.includes(term);
            });

            if (isMatch) {
              lowItems.push({
                name: headerName,
                value: cellVal,
              });
            }
          });
        }

        return {
          sheetName: sheetTitle,
          lastRowIndex: lastRowIndex + 1, // converting to 1-based index
          headers,
          values: lastRowCells,
          lowItems,
          hasLowStock: lowItems.length > 0,
        };

      } catch (err) {
        console.error(`Failed to parse sheet ${sheetTitle}:`, err);
        return null;
      }
    });

    const results = await Promise.all(fetchPromises);
    
    // Sort reports alphabetically by sheet name so they are logically laid out
    return results
      .filter((r): r is SheetReport => r !== null)
      .sort((a, b) => a.sheetName.localeCompare(b.sheetName, 'en'));

  } catch (error: any) {
    console.error('Error parsing sheets:', error);
    throw error;
  }
}
