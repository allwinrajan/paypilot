"use client";
// Invoice table (AG Grid), styled to sit inside a glass card.
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Clock, ExternalLink } from "lucide-react";
import { useMemo } from "react";
import type { Invoice } from "@/lib/db";
import { money, niceDate, StatusPill } from "./ui";

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({
  backgroundColor: "transparent",
  foregroundColor: "#0f172a",
  headerTextColor: "#64748b",
  headerFontWeight: 500,
  borderColor: "rgba(15, 23, 42, 0.06)",
  rowHoverColor: "rgba(37, 99, 235, 0.04)",
  accentColor: "#2563eb",
  fontFamily: "inherit",
  fontSize: 13,
  wrapperBorder: false,
  columnBorder: false,
  spacing: 7,
});

export interface InvoiceGridProps {
  invoices: Invoice[];
  quickFilter?: string;
  height?: number;
  onMarkOverdue?: (invoice: Invoice) => void;
}

export function InvoiceGrid({ invoices, quickFilter, height = 420, onMarkOverdue }: InvoiceGridProps) {
  const columns = useMemo<ColDef<Invoice>[]>(
    () => [
      {
        headerName: "Invoice",
        width: 110,
        valueGetter: (p) => (p.data?.paypalNumber ? `#${p.data.paypalNumber}` : "Demo"),
        cellClass: (p) => (p.value === "Demo" ? "text-slate-400" : "font-medium"),
      },
      { headerName: "Client", field: "clientName", flex: 1.2, minWidth: 150 },
      {
        headerName: "Description",
        field: "description",
        flex: 1.6,
        minWidth: 200,
        cellRenderer: (p: ICellRendererParams<Invoice>) =>
          p.data ? (
            <span className="flex items-center gap-2">
              <span className="truncate">{p.data.description}</span>
              {p.data.installmentNo && (
                <span className="shrink-0 rounded-full bg-indigo-50 px-1.5 text-[11px] font-medium text-indigo-700">
                  {p.data.installmentNo}/{p.data.installmentCount}
                </span>
              )}
            </span>
          ) : null,
      },
      {
        headerName: "Amount",
        field: "amount",
        width: 120,
        type: "rightAligned",
        valueFormatter: (p) => money(p.value ?? 0, p.data?.currency),
        cellClass: "font-medium tabular-nums",
      },
      { headerName: "Due", field: "dueDate", width: 130, valueFormatter: (p) => (p.value ? niceDate(p.value) : "") },
      {
        headerName: "Status",
        field: "displayStatus",
        width: 160,
        cellRenderer: (p: ICellRendererParams<Invoice>) => (p.value ? <StatusPill status={p.value} /> : null),
      },
      {
        headerName: "",
        width: 190,
        sortable: false,
        filter: false,
        cellRenderer: (p: ICellRendererParams<Invoice>) => {
          const inv = p.data;
          if (!inv) return null;
          return (
            <span className="flex h-full items-center gap-1.5">
              {inv.paypalId && (
                <a
                  href={`https://www.sandbox.paypal.com/invoice/s/details/${inv.paypalId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-50"
                >
                  PayPal <ExternalLink className="size-3" />
                </a>
              )}
              {onMarkOverdue && inv.displayStatus === "SENT" && (
                <button
                  onClick={() => onMarkOverdue(inv)}
                  title="Demo: move the due date into the past"
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-900/5"
                >
                  <Clock className="size-3" /> Make overdue
                </button>
              )}
            </span>
          );
        },
      },
    ],
    [onMarkOverdue],
  );

  return (
    <div className="ag-theme-glass" style={{ height }}>
      <AgGridReact<Invoice>
        theme={theme}
        rowData={invoices}
        columnDefs={columns}
        defaultColDef={{ sortable: true, filter: false, resizable: true, suppressHeaderMenuButton: true }}
        getRowId={(p) => String(p.data.id)}
        quickFilterText={quickFilter}
        animateRows
        overlayNoRowsTemplate="No invoices yet. Describe one in the box above."
      />
    </div>
  );
}
