/**
 * Google Sheets import service.
 *
 * Fetches a publicly shared Google Sheets document via the CSV export URL and
 * parses the two product/price column groups defined for TCG Iberia price imports.
 *
 * Left table  → products: B15:B52, prices (JPY): C15:C52
 * Right table → products: G15:G52, prices (JPY): H15:H52
 *
 * Only works with sheets shared publicly ("Anyone with the link can view").
 * Private sheets trigger a login-redirect response which is detected and surfaced
 * as a user-friendly error.
 */

export interface SheetImportItem {
  importedName: string;
  jpyPrice: number;
  /** H-column (right table) price for this source row — used to pre-fill noShrinkPrice when creating a new product. */
  correspondingRightJpyPrice: number | null;
  sourceRow: number;
  sourceGroup: 'left' | 'right';
}

/** Extract the spreadsheet ID from any valid Google Sheets URL. */
function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9\-_]+)/);
  return match ? match[1] : null;
}

/**
 * Extract the sheet (tab) GID from a Google Sheets URL.
 * Supports both hash-based (#gid=…) and query-based (?gid=…) formats.
 * Defaults to '0' (the first sheet) when not present.
 */
function extractGid(url: string): string {
  const hashMatch = url.match(/[#&]gid=(\d+)/);
  if (hashMatch) return hashMatch[1];
  const paramMatch = url.match(/[?&]gid=(\d+)/);
  if (paramMatch) return paramMatch[1];
  return '0';
}

/**
 * Minimal RFC 4180-compliant CSV parser.
 * Handles quoted fields (including embedded commas and escaped double-quotes)
 * and both LF and CRLF line endings.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  // Normalise line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  for (const line of lines) {
    if (line === '') continue;
    const row: string[] = [];
    let inQuotes = false;
    let current = '';

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        row.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    row.push(current);
    rows.push(row);
  }

  return rows;
}

/**
 * Strip common numeric formatting characters (thousand separators, currency
 * symbols, whitespace) so that "¥1,500" or "1 500" can be parsed as a number.
 */
function parseJPY(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) || n <= 0 ? null : n;
}

/**
 * Fetch and parse a Google Sheets document.
 *
 * @param url - Any Google Sheets URL (sharing link, edit URL, etc.)
 * @returns Array of imported items from both the left and right table sections.
 * @throws User-readable error for invalid URLs, private sheets, or fetch failures.
 */
export async function fetchSheetData(url: string): Promise<SheetImportItem[]> {
  const sheetId = extractSheetId(url);
  if (!sheetId) {
    throw new Error('URL de Google Sheets no válida. Asegúrate de que sea un enlace de Google Sheets.');
  }

  const gid = extractGid(url);
  const exportUrl =
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

  let response: Response;
  try {
    response = await fetch(exportUrl, {
      headers: { 'User-Agent': 'TCGIberia-PriceImport/1.0' },
      redirect: 'follow',
    });
  } catch (err) {
    throw new Error('No se pudo conectar a Google Sheets. Verifica tu conexión a internet.');
  }

  if (response.status === 403 || response.status === 401) {
    throw new Error('Acceso denegado. La hoja de cálculo es privada o no tienes permisos.');
  }

  if (!response.ok) {
    throw new Error(`Error al acceder a la hoja de cálculo (HTTP ${response.status}).`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    throw new Error(
      'La hoja de cálculo es privada. Compártela públicamente ("Cualquier persona con el enlace puede ver") e inténtalo de nuevo.'
    );
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error('La hoja de cálculo está vacía o no contiene datos en el rango esperado.');
  }

  const rows = parseCSV(text);
  const items: SheetImportItem[] = [];

  // Rows 15–52 are 1-indexed; in 0-indexed array they are indices 14–51.
  const START_ROW = 14;
  const END_ROW = 51;

  for (let i = START_ROW; i <= END_ROW && i < rows.length; i++) {
    const row = rows[i];
    const sourceRow = i + 1; // human-readable 1-based row number

    // Parse both columns up-front so each item can reference the right-column price
    const leftName = row[1]?.trim() ?? '';
    const leftPriceRaw = row[2]?.trim() ?? '';
    const rightName = row[6]?.trim() ?? '';
    const rightPriceRaw = row[7]?.trim() ?? '';

    const leftPrice = leftPriceRaw ? parseJPY(leftPriceRaw) : null;
    const rightPrice = rightPriceRaw ? parseJPY(rightPriceRaw) : null;

    // ── Left table: column B (index 1), column C (index 2) ────────────────
    if (leftName && leftPrice !== null) {
      items.push({
        importedName: leftName,
        jpyPrice: leftPrice,
        correspondingRightJpyPrice: rightPrice,
        sourceRow,
        sourceGroup: 'left',
      });
    }

    // ── Right table: column G (index 6), column H (index 7) ───────────────
    if (rightName && rightPrice !== null) {
      items.push({
        importedName: rightName,
        jpyPrice: rightPrice,
        correspondingRightJpyPrice: rightPrice, // right IS the no-shrink price
        sourceRow,
        sourceGroup: 'right',
      });
    }
  }

  if (items.length === 0) {
    throw new Error(
      'No se encontraron productos en las filas 15–52 del documento. Verifica que la URL apunte a la hoja correcta.'
    );
  }

  return items;
}
