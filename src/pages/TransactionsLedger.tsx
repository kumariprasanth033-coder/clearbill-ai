/**
 * ClearBill AI - Transactions Ledger
 * Immutable finalized transaction invoices, payment method breakdown, receipt links.
 */

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  Receipt,
  Download,
  Filter,
  CheckCircle2,
  Calendar,
  CreditCard,
  QrCode,
  Banknote,
} from 'lucide-react';
import { Transaction } from '../types.ts';

interface TransactionsLedgerProps {
  onOpenReceipt: (token: string) => void;
}

export const TransactionsLedger: React.FC<TransactionsLedgerProps> = ({ onOpenReceipt }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/transactions')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setTransactions(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = transactions.filter(t => {
    const matchesMethod = methodFilter === 'all' || t.payment_method === methodFilter;
    const matchesSearch =
      search === '' ||
      t.transaction_number.toLowerCase().includes(search.toLowerCase()) ||
      (t.customer_name && t.customer_name.toLowerCase().includes(search.toLowerCase()));
    return matchesMethod && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#172B4D] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#16A34A]" />
            Authoritative Transactions Ledger
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Immutable financial records calculated on server with decimal-safe precision.
          </p>
        </div>

        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg">
          {transactions.length} Total Invoices
        </span>
      </div>

      {/* Filter and Search */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by invoice # or customer name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-[#E2E8F0] rounded-lg pl-9 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#16A34A]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Payment Mode:</span>
          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-[#16A34A]"
          >
            <option value="all">All Modes</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50/70 border-b border-[#E2E8F0] text-slate-500 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items Count</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
                <th className="py-3 px-4 text-right">GST</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-800">{t.transaction_number}</td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(t.created_at).toLocaleDateString()} {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">{t.customer_name || 'Walk-in'}</td>
                  <td className="py-3 px-4 text-slate-600">{t.items?.length || 1} item(s)</td>
                  <td className="py-3 px-4">
                    <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {t.payment_method}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-slate-600">₹{t.subtotal.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right tabular-nums text-slate-600">₹{t.tax_amount.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                    ₹{t.grand_total.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                      Verified
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
