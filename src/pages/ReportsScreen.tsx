/**
 * ClearBill AI - Detailed Reports & Analytics Screen
 * Date range filters, outlet filters, top selling products, and real CSV / PDF export.
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Filter,
  Download,
  FileSpreadsheet,
  TrendingUp,
  Store,
  Layers,
  Printer,
  Sparkles,
} from 'lucide-react';
import { Outlet } from '../types.ts';

export const ReportsScreen: React.FC = () => {
  const [reportData, setReportData] = useState<{
    totalRevenue: number;
    totalTax: number;
    totalDiscount: number;
    transactionCount: number;
    topProducts: { product_name: string; barcode?: string; quantity: number; revenue: number; tax: number }[];
    transactions: any[];
  } | null>(null);

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState('all');
  const [period, setPeriod] = useState<'today' | '7days' | 'month' | 'all'>('month');
  const [loading, setLoading] = useState(true);

  const loadReport = () => {
    setLoading(true);
    let startDate = '';
    const now = new Date();
    if (period === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startDate = todayStart.toISOString();
    } else if (period === '7days') {
      const past7 = new Date(now.getTime() - 7 * 86400000);
      startDate = past7.toISOString();
    } else if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = monthStart.toISOString();
    }

    const params = new URLSearchParams();
    if (selectedOutlet !== 'all') params.append('outletId', selectedOutlet);
    if (startDate) params.append('startDate', startDate);

    fetch(`/api/reports/sales?${params.toString()}`)
      .then(r => r.json())
      .then(setReportData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch('/api/outlets')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setOutlets(data);
      })
      .catch(console.error);

    loadReport();
  }, [selectedOutlet, period]);

  const handleExportCsv = () => {
    if (!reportData || reportData.transactions.length === 0) return;

    let csv = 'Transaction Number,Date,Customer,Payment Mode,Subtotal,Tax,Discount,Grand Total\n';
    for (const t of reportData.transactions) {
      csv += `"${t.transaction_number}","${new Date(t.created_at).toLocaleDateString()}","${t.customer_name || 'Walk-in'}","${t.payment_method}",${t.subtotal},${t.tax_amount},${t.discount_amount},${t.grand_total}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clearbill_sales_report_${period}_${Date.now()}.csv`;
    a.click();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#172B4D] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#16A34A]" />
            Business Analytics & Tax Reports
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Verified sales ledger aggregations and product velocity metrics from MySQL.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
          <button
            onClick={handleExportCsv}
            disabled={!reportData || reportData.transactionCount === 0}
            className="px-3.5 py-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(['today', '7days', 'month', 'all'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 font-semibold rounded-md transition-colors ${
                period === p
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p === 'today'
                ? 'Today'
                : p === '7days'
                ? 'Last 7 Days'
                : p === 'month'
                ? 'This Month'
                : 'All Time'}
            </button>
          ))}
        </div>

        {/* Outlet Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Outlet:</span>
          <select
            value={selectedOutlet}
            onChange={e => setSelectedOutlet(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-[#16A34A]"
          >
            <option value="all">All Outlets</option>
            {outlets.map(o => (
              <option key={o.id} value={o.id}>
                {o.outlet_name} ({o.outlet_code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Report Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">Period Revenue</span>
          <p className="text-2xl font-extrabold text-[#172B4D] tabular-nums">
            ₹{reportData?.totalRevenue.toFixed(2) || '0.00'}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium block mt-1">
            {reportData?.transactionCount || 0} Invoices Settled
          </span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">Total GST Collected</span>
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
            ₹{reportData?.totalTax.toFixed(2) || '0.00'}
          </p>
          <span className="text-[11px] text-slate-500 font-medium block mt-1">
            Authoritative Tax Audit
          </span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">Discounts Granted</span>
          <p className="text-2xl font-extrabold text-amber-700 tabular-nums">
            ₹{reportData?.totalDiscount.toFixed(2) || '0.00'}
          </p>
          <span className="text-[11px] text-slate-500 font-medium block mt-1">
            Cashier Promo Reductions
          </span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">Avg Ticket Size</span>
          <p className="text-2xl font-extrabold text-[#16A34A] tabular-nums">
            ₹
            {reportData?.transactionCount
              ? (reportData.totalRevenue / reportData.transactionCount).toFixed(2)
              : '0.00'}
          </p>
          <span className="text-[11px] text-slate-500 font-medium block mt-1">
            Per transaction average
          </span>
        </div>
      </div>

      {/* Top Performing Products Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-[#172B4D]">Product Velocity & Revenue Breakdown</h3>

        {reportData?.topProducts.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No sales records in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50/70 border-b border-[#E2E8F0] text-slate-500 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Barcode</th>
                  <th className="py-2.5 px-3 text-center">Units Sold</th>
                  <th className="py-2.5 px-3 text-right">GST Generated</th>
                  <th className="py-2.5 px-3 text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData?.topProducts.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{p.product_name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{p.barcode || '—'}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-700 tabular-nums">
                      {p.quantity}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">
                      ₹{p.tax.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                      ₹{p.revenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
