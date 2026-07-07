/**
 * ExcelJS-based export utility (Audit Fix #29 / P0).
 *
 * Replaces the vulnerable `xlsx` package (CVE-2023-30533 prototype pollution
 * + CVE-2024-22363 ReDoS). The public API mirrors the previous `exportToExcel`
 * signature so existing call sites work unchanged.
 *
 * Usage:
 *   await exportToExcel("cotisations.xlsx", "Cotisations", rows, columns);
 */

import ExcelJS from "exceljs";

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  format?: string;
}

export async function exportToExcel(
  filename: string,
  sheetName: string,
  rows: Record<string, unknown>[],
  columns: ExcelColumn[]
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "E2D Connect Gateway";
  wb.created = new Date();

  const ws = wb.addWorksheet(sheetName, {
    properties: { defaultRowHeight: 18 },
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // Define columns
  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? 20,
  }));

  // Header styling
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2937" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.height = 24;

  // Data rows
  for (const row of rows) {
    const r = ws.addRow(row);
    columns.forEach((col) => {
      if (col.format) {
        const cell = r.getCell(col.key);
        cell.numFmt = col.format;
      }
    });
  }

  // Auto-filter on header
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  // Generate and download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Backward-compatible export for simple sheet-only exports.
 * Kept for call sites that previously did:
 *   XLSX.utils.book_new() / sheet_to_json / writeFile
 */
export async function exportSimpleSheet(
  filename: string,
  sheetName: string,
  data: Record<string, unknown>[]
): Promise<void> {
  if (data.length === 0) {
    await exportToExcel(filename, sheetName, [], [{ header: "Aucune donnée", key: "_empty", width: 20 }]);
    return;
  }
  const columns: ExcelColumn[] = Object.keys(data[0]).map((key) => ({
    header: key,
    key,
    width: 20,
  }));
  await exportToExcel(filename, sheetName, data, columns);
}
