import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type RowData,
  type SortingFn,
} from '@tanstack/react-table'
import SentimentBadge from './SentimentBadge'
import type { DashboardRow } from '../hooks/useDashboard'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    tdClass?: string
  }
}

function formatMarketCap(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  return `$${v.toLocaleString()}`
}

function fmt(v: number | null | undefined, decimals = 2): string {
  return v == null ? '—' : v.toFixed(decimals)
}

interface StockTableProps {
  rows: DashboardRow[]
  onAnalyze: (symbol: string) => void
  onRemove: (symbol: string) => void
  analyzing: string | null
}

const columnHelper = createColumnHelper<DashboardRow>()

// Custom sort: nulls/undefined always go to the bottom regardless of direction
const nullsLastSort: SortingFn<DashboardRow> = (rowA, rowB, columnId) => {
  const a = rowA.getValue(columnId)
  const b = rowB.getValue(columnId)
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return a < b ? -1 : a > b ? 1 : 0
}

const thClass = 'px-3 py-2 text-left text-xs font-medium text-[#5E6C84] uppercase tracking-wider cursor-pointer select-none hover:text-[#172B4D]'
const tdClass = 'px-3 py-3 text-sm'

const columnExtraClasses: Record<string, string> = {
  symbol: `${tdClass} font-bold text-[#0052CC]`,
  company_name: `${tdClass} text-[#344563] max-w-[160px] truncate`,
  price: `${tdClass} text-[#172B4D]`,
  date: `${tdClass} text-[#8993A4] text-xs`,
  actions: `${tdClass} flex items-center gap-2`,
}

export default function StockTable({ rows, onAnalyze, onRemove, analyzing }: StockTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo(() => [
    columnHelper.accessor('symbol', {
      header: 'Symbol',
      sortingFn: nullsLastSort,
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor((row) => row.data?.company_name ?? undefined, {
      id: 'company_name',
      header: 'Company',
      enableSorting: false,
      cell: (info) => {
        const val = info.getValue()
        return <span title={val ?? ''}>{val ?? '—'}</span>
      },
    }),
    columnHelper.accessor((row) => row.data?.price ?? undefined, {
      id: 'price',
      header: 'Price',
      sortingFn: nullsLastSort,
      cell: (info) => {
        const v = info.getValue()
        return v != null ? `$${v.toFixed(2)}` : '—'
      },
    }),
    columnHelper.accessor((row) => row.data?.pe_ratio ?? undefined, {
      id: 'pe_ratio',
      header: 'P/E',
      sortingFn: nullsLastSort,
      cell: (info) => fmt(info.getValue(), 1),
    }),
    columnHelper.accessor((row) => row.data?.market_cap ?? undefined, {
      id: 'market_cap',
      header: 'Mkt Cap',
      sortingFn: nullsLastSort,
      cell: (info) => formatMarketCap(info.getValue()),
    }),
    columnHelper.accessor((row) => row.data?.beta ?? undefined, {
      id: 'beta',
      header: 'Beta',
      sortingFn: nullsLastSort,
      cell: (info) => fmt(info.getValue()),
    }),
    columnHelper.accessor((row) => row.data?.sentiment ?? undefined, {
      id: 'sentiment',
      header: 'Sentiment',
      sortingFn: nullsLastSort,
      cell: (info) => <SentimentBadge sentiment={info.getValue()} />,
    }),
    columnHelper.accessor((row) => row.data?.date ?? undefined, {
      id: 'date',
      header: 'Last Analysis',
      sortingFn: nullsLastSort,
      cell: (info) => {
        const v = info.getValue()
        return v ? new Date(v).toLocaleDateString() : '—'
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: (info) => {
        const symbol = info.row.original.symbol
        return (
          <>
            <Link
              to={`/news/${symbol}`}
              className="rounded px-2 py-1 text-xs bg-[#F0F2F5] text-[#344563] hover:bg-[#DFE1E6] transition cursor-pointer"
            >
              News
            </Link>
            <button
              onClick={() => onAnalyze(symbol)}
              disabled={analyzing !== null}
              className="rounded px-2 py-1 text-xs bg-[#0052CC] text-white hover:bg-[#0065FF] disabled:opacity-50 transition flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
            >
              {analyzing === symbol ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Running
                </>
              ) : 'Analyze'}
            </button>
            <button
              onClick={() => onRemove(symbol)}
              disabled={analyzing !== null}
              title="Remove"
              className="rounded p-1 text-black hover:bg-red-50 hover:text-red-700 disabled:opacity-50 transition cursor-pointer disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </>
        )
      },
    }),
  ], [onAnalyze, onRemove, analyzing])

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: true,
    enableMultiSort: false,
    sortDescFirst: false,
  })

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-[#8993A4]">
        No stocks yet. Add a ticker using the button above.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[#DFE1E6]">
            {table.getFlatHeaders().map((header) => {
              const canSort = header.column.getCanSort()
              const sorted = header.column.getIsSorted()
              const sortIndicator = sorted === 'asc' ? ' ↑' : sorted === 'desc' ? ' ↓' : ''
              return (
                <th
                  key={header.id}
                  className={canSort ? thClass : `${thClass} cursor-default hover:text-[#5E6C84]`}
                  onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {sortIndicator}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            if (row.original.loading) {
              return (
                <tr key={row.id} className="border-b border-[#DFE1E6]">
                  {row.getVisibleCells().map((cell, i) => (
                    <td key={cell.id} className={tdClass}>
                      <div
                        className="h-4 rounded bg-[#DFE1E6] animate-pulse"
                        style={{ width: i === 0 ? '4rem' : '6rem' }}
                      />
                    </td>
                  ))}
                </tr>
              )
            }
            return (
              <tr key={row.id} className="border-b border-[#DFE1E6] hover:bg-[#F8F9FA]">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={columnExtraClasses[cell.column.id] ?? tdClass}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
