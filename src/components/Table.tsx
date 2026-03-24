import { Box, Text } from "ink";
import React from "react";

interface Column {
  key: string;
  label: string;
  width?: number;
}

interface CellStyle {
  color?: string;
  bold?: boolean;
}

interface TableProps {
  columns: Column[];
  rows: Record<string, string>[];
  getCellStyle?: (value: string, columnKey: string, row: Record<string, string>) => CellStyle;
}

export function Table({ columns, rows, getCellStyle }: TableProps) {
  const colWidths = columns.map((col) => {
    const headerLen = col.label.length;
    const maxDataLen = rows.reduce((max, row) => Math.max(max, (row[col.key] || "").length), 0);
    return col.width || Math.max(headerLen, maxDataLen) + 2;
  });

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        {columns.map((col, i) => (
          <Box key={col.key} width={colWidths[i]}>
            <Text bold dimColor>
              {col.label}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Separator */}
      <Box>
        <Text dimColor>{"─".repeat(colWidths.reduce((sum, w) => sum + w, 0))}</Text>
      </Box>

      {/* Rows */}
      {rows.map((row, rowIdx) => (
        <Box key={`row-${rowIdx}`}>
          {columns.map((col, colIdx) => {
            const value = row[col.key] || "";
            const style = getCellStyle?.(value, col.key, row) || {};
            return (
              <Box key={col.key} width={colWidths[colIdx]}>
                <Text color={style.color} bold={style.bold}>
                  {value}
                </Text>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

export function driftCellStyle(
  value: string,
  columnKey: string,
  row: Record<string, string>,
): CellStyle {
  if (columnKey === "service") {
    return { bold: true };
  }

  if (columnKey === "status") {
    if (value.includes("sync")) return { color: "green" };
    if (value.includes("major")) return { color: "red", bold: true };
    if (value.includes("minor")) return { color: "yellow" };
    if (value.includes("patch")) return { color: "cyan" };
    if (value.includes("drift")) return { color: "red" };
    return { color: "yellow" };
  }

  // Color version cells based on the row's drift status
  const status = row.status || "";
  if (status.includes("sync")) return { color: "green" };
  if (status.includes("major")) return { color: "red" };
  if (status.includes("minor")) return { color: "yellow" };
  if (status.includes("patch")) return { color: "cyan" };
  if (value === "—") return { color: "gray" };

  return {};
}
