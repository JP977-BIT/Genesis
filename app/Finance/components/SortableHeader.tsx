"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc";

type SortableHeaderProps<Column extends string> = {
  label: string;
  column: Column;
  align?: "left" | "right" | "center";
  sortColumn: Column | null;
  sortDirection: SortDirection;
  onSort: (column: Column) => void;
};

export default function SortableHeader<Column extends string>({
  label,
  column,
  align = "left",
  sortColumn,
  sortDirection,
  onSort,
}: SortableHeaderProps<Column>) {
  const isActive = sortColumn === column;

  const thAlign =
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";

  const buttonAlign =
    align === "right"
      ? "justify-end"
      : align === "center"
        ? "justify-center"
        : "justify-start";

  return (
    <th className={`px-5 py-3 ${thAlign}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`flex items-center gap-1 w-full uppercase hover:text-[#0f766e] transition ${buttonAlign}`}
      >
        <span>{label}</span>
        {isActive ? (
          sortDirection === "asc" ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          )
        ) : (
          <ChevronsUpDown size={14} className="text-gray-300" />
        )}
      </button>
    </th>
  );
}
