/**
 * Export Utility Functions
 *
 * Provides functions to export data to CSV, XLSX, and JSON formats.
 */

import * as XLSX from 'xlsx';

/**
 * Export data to CSV format
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[]
) {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  // If columns are specified, use them; otherwise use all keys from first object
  const headers = columns
    ? columns.map(col => col.label)
    : Object.keys(data[0]);

  const keys = columns
    ? columns.map(col => col.key as string)
    : Object.keys(data[0]);

  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row =>
      keys
        .map(key => {
          const value = row[key];
          // Handle values that might contain commas or quotes
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(',')
    )
  ].join('\n');

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Export data to Excel (XLSX) format
 */
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  filename: string,
  sheetName: string = 'Sheet1',
  columns?: { key: keyof T; label: string }[]
) {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  // Transform data if columns are specified
  let exportData: any[];
  if (columns) {
    exportData = data.map(row => {
      const transformedRow: Record<string, any> = {};
      columns.forEach(col => {
        transformedRow[col.label] = row[col.key];
      });
      return transformedRow;
    });
  } else {
    exportData = data;
  }

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Auto-size columns
  const columnWidths = Object.keys(exportData[0]).map(key => ({
    wch: Math.max(
      key.length,
      ...exportData.map(row => String(row[key] || '').length)
    )
  }));
  worksheet['!cols'] = columnWidths;

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate and download file
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Export data to JSON format
 */
export function exportToJSON<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[]
) {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  // Transform data if columns are specified
  let exportData: any[];
  if (columns) {
    exportData = data.map(row => {
      const transformedRow: Record<string, any> = {};
      columns.forEach(col => {
        transformedRow[col.label] = row[col.key];
      });
      return transformedRow;
    });
  } else {
    exportData = data;
  }

  // Create JSON content with formatting
  const jsonContent = JSON.stringify(exportData, null, 2);

  // Create and download file
  const blob = new Blob([jsonContent], { type: 'application/json' });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * Helper function to download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Format date for export
 */
export function formatDateForExport(date: string | Date | null): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format datetime for export
 */
export function formatDateTimeForExport(date: string | Date | null): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
