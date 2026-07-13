/**
 * Export utilities — PDF + Excel (Feature #3, #8)
 * Wrappers around jspdf and exceljs for consistent exports.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportToExcel as excelExport, type ExcelColumn } from '@/lib/excel-export';

export interface ExportRow {
  [key: string]: string | number;
}

export async function exportToPDF(opts: {
  title: string;
  subtitle?: string;
  rows: (string | number)[][];
  filename: string;
}): Promise<void> {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(opts.title, 14, 22);

  if (opts.subtitle) {
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(opts.subtitle, 14, 30);
  }

  autoTable(doc, {
    startY: opts.subtitle ? 38 : 30,
    head: [opts.rows[0] ?? []],
    body: opts.rows.slice(1),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 58, 95] },
  });

  doc.save(opts.filename);
}

export async function exportToExcel(
  filename: string,
  sheetName: string,
  rows: Record<string, unknown>[],
  columns: ExcelColumn[]
): Promise<void> {
  await excelExport(filename, sheetName, rows, columns);
}

export { ExcelColumn };
