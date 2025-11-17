"use client";

import { Table } from "@tanstack/react-table";
import { AnnouncementListItem } from "@/types/communication";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { X, Filter, Download, Send, Trash2, Settings2 } from "lucide-react";
import { DataTableFacetedFilter } from "@/components/data-table/data-table-faceted-filter";
import Link from "next/link";

interface AnnouncementsTableToolbarProps<TData> {
  table: Table<TData>;
  onBulkSend?: (ids: string[]) => void;
  onBulkDelete?: (ids: string[]) => void;
  onExport?: () => void;
}

export function AnnouncementsTableToolbar<TData>({
  table,
  onBulkSend,
  onBulkDelete,
  onExport,
}: AnnouncementsTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  const selectedRows = table.getFilteredSelectedRowModel().rows;

  const statusOptions = [
    { label: "Draft", value: "draft" },
    { label: "Scheduled", value: "scheduled" },
    { label: "Sending", value: "sending" },
    { label: "Sent", value: "sent" },
    { label: "Cancelled", value: "cancelled" },
    { label: "Failed", value: "failed" },
  ];

  const channelOptions = [
    { label: "Email", value: "email" },
    { label: "WhatsApp", value: "whatsapp" },
    { label: "In-App", value: "in_app" },
  ];

  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex flex-1 items-center space-x-2">
        {/* Search */}
        <Input
          placeholder="Search announcements..."
          value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("title")?.setFilterValue(event.target.value)
          }
          className="h-9 w-[200px] lg:w-[300px]"
        />

        {/* Status Filter */}
        {table.getColumn("status") && (
          <DataTableFacetedFilter
            column={table.getColumn("status")}
            title="Status"
            options={statusOptions}
          />
        )}

        {/* Channel Filter */}
        {table.getColumn("channels") && (
          <DataTableFacetedFilter
            column={table.getColumn("channels")}
            title="Channels"
            options={channelOptions}
          />
        )}

        {/* Clear Filters */}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-9 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Bulk Actions */}
        {selectedRows.length > 0 && (
          <>
            <div className="text-sm text-muted-foreground mr-2">
              {selectedRows.length} selected
            </div>

            {onBulkSend && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const ids = selectedRows.map((row) => (row.original as AnnouncementListItem).id);
                  onBulkSend(ids);
                }}
              >
                <Send className="mr-2 h-4 w-4" />
                Send Selected
              </Button>
            )}

            {onBulkDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const ids = selectedRows.map((row) => (row.original as AnnouncementListItem).id);
                  onBulkDelete(ids);
                }}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected
              </Button>
            )}
          </>
        )}

        {/* Export */}
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        )}

        {/* Column Visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="mr-2 h-4 w-4" />
              View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px]">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter(
                (column) =>
                  typeof column.accessorFn !== "undefined" && column.getCanHide()
              )
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
