"use client";

import {
  type Column,
  type RowData,
  type SortDirection,
  type SortingState,
  Subscribe,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import * as React from "react";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { useDirection } from "@/components/ui/direction";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUp01Icon, UnfoldMoreIcon, ViewOffIcon } from "@hugeicons/core-free-icons";

interface DataTableColumnHeaderProps<
  TData extends RowData,
  TValue,
> extends React.ComponentProps<typeof DropdownMenuTrigger> {
  column: Column<DataTableFeatures, TData, TValue>;
  label: string;
}

export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  label,
  className,
  ...props
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort() && !column.getCanHide()) {
    return <div className={cn(className)}>{label}</div>;
  }

  return (
    <Subscribe
      source={column.table.store}
      selector={(state) => ({
        isVisible: state.columnVisibility[column.id] !== false,
        sortDirection: getSortDirection(state.sorting, column.id),
      })}
    >
      {(headerState) => (
        <DataTableColumnHeaderMenu
          column={column}
          label={label}
          className={className}
          isVisible={headerState.isVisible}
          sortDirection={headerState.sortDirection}
          {...props}
        />
      )}
    </Subscribe>
  );
}

interface DataTableColumnHeaderMenuProps<
  TData extends RowData,
  TValue,
> extends DataTableColumnHeaderProps<TData, TValue> {
  isVisible: boolean;
  sortDirection: SortDirection | "none";
}

function DataTableColumnHeaderMenu<TData extends RowData, TValue>({
  column,
  label,
  className,
  isVisible,
  sortDirection,
  ...props
}: DataTableColumnHeaderMenuProps<TData, TValue>) {
  const dir = useDirection();

  function onSortDirectionChange(direction: SortDirection) {
    if (sortDirection === direction) {
      column.clearSorting();
      return;
    }

    column.toggleSorting(direction === "desc", true);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "-ms-1.5 flex h-8 items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-accent focus:ring-1 focus:ring-ring focus:outline-none data-[state=open]:bg-accent rtl:flex-row-reverse [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
          className,
        )}
        {...props}
      >
        {label}
        {column.getCanSort() &&
          (sortDirection === "desc" ? (
            <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
          ) : sortDirection === "asc" ? (
            <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} />
          ) : (
            <HugeiconsIcon icon={UnfoldMoreIcon} strokeWidth={2} />
          ))}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        dir={dir}
        align="start"
        className="w-28 data-closed:fill-mode-forwards"
      >
        {column.getCanSort() && (
          <>
            <DropdownMenuCheckboxItem
              className="[&_svg]:text-muted-foreground"
              checked={sortDirection === "asc"}
              onClick={() => onSortDirectionChange("asc")}
            >
              <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} />
              Asc
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className="[&_svg]:text-muted-foreground"
              checked={sortDirection === "desc"}
              onClick={() => onSortDirectionChange("desc")}
            >
              <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
              Desc
            </DropdownMenuCheckboxItem>
          </>
        )}
        {column.getCanHide() && (
          <DropdownMenuCheckboxItem
            className="[&_svg]:text-muted-foreground"
            checked={!isVisible}
            onClick={() => column.toggleVisibility(false)}
          >
            <HugeiconsIcon icon={ViewOffIcon} strokeWidth={2} />
            Hide
          </DropdownMenuCheckboxItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getSortDirection(
  sorting: SortingState,
  columnId: string,
): SortDirection | "none" {
  const sort = sorting.find((sort) => sort.id === columnId);
  if (!sort) return "none";
  return sort.desc ? "desc" : "asc";
}
