import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type RowSelectionState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, EmptyState, ErrorState, LoadingBlock, Select } from "@/components/ui";
import type { ListState } from "@/hooks/useListState";
import type { Page } from "@/types/models";
import { cn } from "@/utils/format";

export interface Col<T> { id: string; header: string; cell: (row: T) => ReactNode; sortKey?: string; className?: string }

export function DataTable<T extends { id: number }>({ query, columns, state, onRowClick, selectable, bulkActions,
  empty, toolbar }: {
  query: { data?: Page<T>; isLoading: boolean; error: unknown; refetch: () => void; isFetching?: boolean };
  columns: Col<T>[]; state: ListState; onRowClick?: (row: T) => void; selectable?: boolean;
  bulkActions?: (ids: number[], clear: () => void) => ReactNode; empty?: ReactNode; toolbar?: ReactNode }) {
  const [selection, setSelection] = useState<RowSelectionState>({});
  const defs: ColumnDef<T>[] = columns.map((c) => ({ id: c.id, header: c.header, cell: (ctx) => c.cell(ctx.row.original) }));
  if (selectable) {
    defs.unshift({
      id: "_select",
      header: ({ table }) => <input type="checkbox" aria-label="Select all rows" className="h-3.5 w-3.5"
        checked={table.getIsAllRowsSelected()} onChange={table.getToggleAllRowsSelectedHandler()} />,
      cell: ({ row }) => <input type="checkbox" aria-label="Select row" className="h-3.5 w-3.5" checked={row.getIsSelected()}
        onClick={(e) => e.stopPropagation()} onChange={row.getToggleSelectedHandler()} />,
    });
  }
  const table = useReactTable({ data: query.data?.items ?? [], columns: defs, getCoreRowModel: getCoreRowModel(),
    manualPagination: true, manualSorting: true, enableRowSelection: !!selectable, state: { rowSelection: selection },
    onRowSelectionChange: setSelection, getRowId: (r) => String(r.id) });
  const ids = Object.keys(selection).filter((k) => selection[k]).map(Number);
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / state.pageSize));
  const colMeta = Object.fromEntries(columns.map((c) => [c.id, c]));

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      {(toolbar || (selectable && ids.length > 0)) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
          {selectable && ids.length > 0 ? (
            <><span className="text-sm text-slate-700">{ids.length} selected</span>
              {bulkActions?.(ids, () => setSelection({}))}
              <Button size="sm" variant="ghost" onClick={() => setSelection({})}>Clear selection</Button></>
          ) : toolbar}
        </div>
      )}
      {query.error ? <div className="p-3"><ErrorState error={query.error} onRetry={query.refetch} /></div> :
        query.isLoading ? <div className="p-3"><LoadingBlock rows={8} /></div> :
          total === 0 ? (empty ?? <EmptyState title="No records match these filters" body="Clear a filter or broaden the search." />) : (
            <div className="max-w-full overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead className="bg-slate-50">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => {
                        const meta = colMeta[h.column.id];
                        const sortKey = meta?.sortKey;
                        const active = sortKey && state.sort === sortKey;
                        return (
                          <th key={h.id} scope="col" className={cn("whitespace-nowrap border-b border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-600", meta?.className)}>
                            {sortKey ? (
                              <button className="inline-flex items-center gap-1 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
                                onClick={() => state.setSort(sortKey)} aria-label={`Sort by ${meta.header}`}>
                                {meta.header}
                                {active && (state.order === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                              </button>
                            ) : flexRender(h.column.columnDef.header, h.getContext())}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody className={cn(query.isFetching && "opacity-70")}>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                      onKeyDown={onRowClick ? (e) => { if (e.key === "Enter") onRowClick(row.original); } : undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                      className={cn("border-b border-slate-100 last:border-0", onRowClick && "cursor-pointer hover:bg-slate-50 focus-visible:bg-accent-soft focus-visible:outline-none",
                        row.getIsSelected() && "bg-accent-soft")}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className={cn("px-3 py-2 align-top", colMeta[cell.column.id]?.className)}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
        <span>{total.toLocaleString()} records</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">Rows
            <Select className="h-7 w-16 text-xs" value={state.pageSize} onChange={(e) => state.setPageSize(Number(e.target.value))}>
              {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </label>
          <Button size="sm" variant="ghost" disabled={state.page <= 1} onClick={() => state.setPage(state.page - 1)} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" /></Button>
          <span className="tabular-nums">Page {state.page} of {pages}</span>
          <Button size="sm" variant="ghost" disabled={state.page >= pages} onClick={() => state.setPage(state.page + 1)} aria-label="Next page">
            <ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

export function FilterChips({ state, labels }: { state: ListState; labels?: Record<string, Record<string, string>> }) {
  const active = Object.entries(state.filters).filter(([, v]) => v);
  if (!active.length && !state.q) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {state.q && <Chip onRemove={() => state.setQ("")}>Search: {state.q}</Chip>}
      {active.map(([k, v]) => <Chip key={k} onRemove={() => state.setFilter(k, "")}>
        {k.replace(/_id$/, "").replace(/_/g, " ")}: {labels?.[k]?.[v] ?? v.replace(/_/g, " ")}</Chip>)}
      <button className="text-xs text-accent hover:underline" onClick={state.clear}>Clear all</button>
    </div>
  );
}

function Chip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2 pr-1 text-xs text-slate-700">
    {children}<button onClick={onRemove} className="rounded-full px-1 hover:bg-slate-200" aria-label="Remove filter">×</button></span>;
}
