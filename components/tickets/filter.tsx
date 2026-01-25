'use client'

import { ReactNode } from "react";
import { Input } from "../ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { CircleCheck, FileText, FunnelX, X } from "lucide-react";

interface FilterableColumn {
    key: string;
    label: string;
    icon: ReactNode;
}

interface TicketsFilterProps {
    filterableColumns: FilterableColumn[];
    columnFilters: Record<string, Set<string>>;
    getUniqueValues: (key: string) => (string | number | boolean | null | undefined)[];
    toggleFilter: (columnKey: string, value: string) => void;
    clearColumnFilter: (columnKey: string) => void;
    setColumnFilters: (filters: Record<string, Set<string>>) => void;
}

export const TicketsFilter = ({
    filterableColumns,
    columnFilters,
    getUniqueValues,
    toggleFilter,
    clearColumnFilter,
    setColumnFilters
}: TicketsFilterProps) => {
    return (
        <div className="flex items-center gap-2 py-4 flex-wrap">
            <Input
                placeholder="ค้นหาไอดีคำร้อง..."
                className="max-w-sm flex-1"
                style={{ backgroundColor: "#ffffff" }}
            />
            {filterableColumns.map(column => {
                const uniqueValues = getUniqueValues(column.key);
                const activeFilters = columnFilters[column.key]?.size || 0;

                return (
                    <DropdownMenu key={column.key}>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-dashed"
                            >
                                {column.icon}
                                <span className="ml-2">{column.label}</span>
                                {activeFilters > 0 && (
                                    <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                                        {activeFilters}
                                    </span>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            <div className="flex justify-between">
                                <DropdownMenuLabel>
                                    {column.label}
                                </DropdownMenuLabel>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => clearColumnFilter(column.key)}
                                ><FunnelX className="w-12 text-red-700" /></Button>
                            </div>
                            <DropdownMenuSeparator />
                            {uniqueValues.map((value) => (
                                <DropdownMenuCheckboxItem
                                    key={String(value)}
                                    checked={columnFilters[column.key]?.has(String(value)) || false}
                                    onCheckedChange={() => toggleFilter(column.key, String(value))}
                                >
                                    {String(value)}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            })}

            {Object.keys(columnFilters).length > 0 && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setColumnFilters({})}
                    className="h-8 px-2 lg:px-3"
                >
                    Reset
                    <X className="ml-2 h-4 w-4" />
                </Button>
            )}
        </div>
    )
}