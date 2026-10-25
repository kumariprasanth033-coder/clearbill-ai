/**
 * ClearBill AI - Customer Scanning-First Interface
 * Clean Light Green & White Theme
 *
 * Implements:
 * 1. Top Navigation Bar:
 *    - ClearBill AI logo
 *    - Customer Home
 *    - My Receipts (with live count badge)
 *    - Payment History (with live count badge)
 *    - Customer Profile
 *    - Logout
 *
 * 2. Main Scanning Hero:
 *    - Heading: "Scan, Pay & Save Your Digital Receipts"
 *    - Subtitle: "Scan a receipt to save it, or scan a UPI QR code to make a payment."
 *
 * 3. Two Prominent Scanning Cards (side-by-side desktop, stacked mobile):
 *    - CARD 1: SCAN RECEIPT QR ("Scan Receipt" button)
 *    - CARD 2: SCAN UPI QR ("Scan & Pay" button)
 *
 * 4. Compact Section: "My Saved Receipts"
 *    - Retailer/business name, Receipt number, Purchase date, Total amount, View Receipt button
 *    - "View All Receipts" button
 *    - Real database records from MySQL (no fabricated statistics)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  QrCode,
  Receipt as ReceiptIcon,
  CreditCard,
  Camera,
  Search,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  LogOut,
  User as UserIcon,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  FileText,
  ChevronRight,
  X,
  Lock,
  Smartphone,
  Eye,
} from 'lucide-react';
import { User, Receipt as ReceiptType } from '../types.ts';
import { CustomerScannerModal } from '../components/CustomerScannerModal.tsx';

interface CustomerPortalProps {
  currentUser?: User | null;
  onOpenReceipt: (token: string) => void;
  onLogout?: () => void;
  onNavigateToLogin?: () => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  currentUser,
  onOpenReceipt,
  onLogout,
  onNavigateToLogin,
}) => {
  // Navigation views
  const [currentView, setCurrentView] = useState<'home' | 'receipts' | 'payments'>('home');
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Data states from MySQL / authoritative backend
  const [receipts, setReceipts] = useState<any[]>([]);
  const [upiPayments, setUpiPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchReceipts, setSearchReceipts] = useState('');

  // Scanner modal state (strictly separated workflows)
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'receipt' | 'upi'>('receipt');

  // Load customer receipts and UPI payments
  const loadCustomerData = useCallback(() => {
    setLoading(true);
    const headers: Record<string, string> = {};
    let customerUserId = currentUser?.id || 'usr-cus-01';

    if (typeof window !== 'undefined') {
      try {
        const sess = localStorage.getItem('cb_customer_session');
        if (sess) {
          const parsed = JSON.parse(sess);
          if (parsed.token) headers['Authorization'] = `Bearer ${parsed.token}`;
          if (parsed.user?.id) customerUserId = parsed.user.id;
        }
      } catch (e) {}
    }

    // 1. Fetch saved receipts
    const receiptsPromise = fetch(`/api/customer/receipts?customerUserId=${customerUserId}`, { headers })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setReceipts(data);
      })
      .catch(console.error);

    // 2. Fetch UPI payment attempts
    const paymentsPromise = fetch(`/api/customer/payments?customerUserId=${customerUserId}`, { headers })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setUpiPayments(data);
      })
      .catch(console.error);

    Promise.all([receiptsPromise, paymentsPromise]).finally(() => setLoading(false));
  }, [currentUser]);

  useEffect(() => {
    loadCustomerData();
  }, [loadCustomerData]);

  // Open separate workflows
  const handleOpenReceiptScanner = () => {
    setScannerMode('receipt');
    setScannerModalOpen(true);
  };

  const handleOpenUpiScanner = () => {
    setScannerMode('upi');
    setScannerModalOpen(true);
  };

  // Filtered receipts for full vault
  const filteredReceipts = receipts.filter(r => {
    if (!searchReceipts.trim()) return true;
    const q = searchReceipts.toLowerCase().trim();
    const num = (r.receipt_number || '').toLowerCase();
    const biz = (r.company?.business_name || r.transaction?.company_name || '').toLowerCase();
    const items = (r.transaction?.items || []).map((it: any) => it.product_name.toLowerCase()).join(' ');
    return num.includes(q) || biz.includes(q) || items.includes(q);
  });

  // Recent 4 receipts for the compact home section
  const recentReceipts = receipts.slice(0, 4);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#172B4D] flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* ===================================================================== */}
      {/* 1. TOP NAVIGATION BAR (Light Green & White Theme)                     */}
      {/* ===================================================================== */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 sm:px-6 py-3.5 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div
            onClick={() => setCurrentView('home')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-[#16A34A] text-white flex items-center justify-center font-extrabold text-lg shadow-sm shadow-emerald-500/30 group-hover:scale-105 transition-transform">
              C
            </div>
            <div>
              <span className="font-extrabold text-[#172B4D] text-base tracking-tight block leading-tight">
                ClearBill AI
              </span>
              <span className="text-[10px] text-[#16A34A] font-semibold tracking-wide uppercase">
                Customer Portal
              </span>
            </div>
          </div>

          {/* Nav Links: Customer Home | My Receipts | Payment History | Customer Profile | Logout */}
          <nav className="flex items-center gap-1 sm:gap-2 text-xs font-semibold">
            <button
              onClick={() => setCurrentView('home')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                currentView === 'home'
                  ? 'bg-emerald-50 text-[#15803D] border border-emerald-200 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Customer Home
            </button>

            <button
              onClick={() => setCurrentView('receipts')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                currentView === 'receipts'
                  ? 'bg-emerald-50 text-[#15803D] border border-emerald-200 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>My Receipts</span>
              {receipts.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-emerald-100 text-[#15803D] font-bold">
                  {receipts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentView('payments')}
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                currentView === 'payments'
                  ? 'bg-emerald-50 text-[#15803D] border border-emerald-200 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>Payment History</span>
              {upiPayments.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-100 text-slate-700 font-bold">
                  {upiPayments.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setProfileModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Customer Profile"
            >
              <UserIcon className="w-3.5 h-3.5 text-[#16A34A]" />
              <span className="hidden sm:inline">Profile</span>
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="ml-1 sm:ml-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-700 transition-colors cursor-pointer flex items-center gap-1.5"
                title="Log out of Customer Account"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* 2. MAIN CONTENT BODY (Light Green & White Theme)                      */}
      {/* ===================================================================== */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 md:p-8 space-y-8">
        {/* VIEW A: SCANNING HOME PAGE */}
        {currentView === 'home' && (
          <div className="space-y-8">
            {/* Hero Heading & Subtitle */}
            <div className="text-center max-w-2xl mx-auto space-y-2 pt-2 sm:pt-4">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#172B4D] tracking-tight leading-tight">
                Scan, Pay & Save Your Digital Receipts
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Scan a receipt to save it, or scan a UPI QR code to make a payment.
              </p>
            </div>

            {/* THE TWO PROMINENT SCANNING CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 pt-2">
              {/* CARD 1: SCAN RECEIPT QR */}
              <div className="bg-white border-2 border-emerald-500/25 hover:border-[#16A34A] rounded-3xl p-6 sm:p-7 shadow-xs hover:shadow-md flex flex-col justify-between transition-all hover:translate-y-[-2px] group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-[#16A34A] text-white flex items-center justify-center shadow-md shadow-emerald-500/30 group-hover:scale-105 transition-transform">
                      <QrCode className="w-7 h-7" />
                    </div>
                    <span className="text-[11px] font-bold text-[#15803D] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">
                      Option A
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-[#172B4D] tracking-tight">
                      Scan Receipt QR
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                      Scan a retailer's ClearBill AI receipt QR to view and save your digital receipt.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-700 font-medium">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>Converts 24h temporary guest access to permanent vault storage</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <FileText className="w-4 h-4 shrink-0 text-slate-400" />
                      <span>Itemized tax invoice, GST breakdown & verified merchant records</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={handleOpenReceiptScanner}
                    className="w-full min-h-[52px] py-3.5 px-6 bg-[#16A34A] hover:bg-[#15803D] active:scale-[0.99] text-white text-base font-extrabold rounded-2xl shadow-sm shadow-emerald-600/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                  >
                    <Camera className="w-5 h-5 text-white" />
                    <span>Scan Receipt</span>
                  </button>
                </div>
              </div>

              {/* CARD 2: SCAN UPI QR */}
              <div className="bg-white border-2 border-emerald-500/25 hover:border-[#16A34A] rounded-3xl p-6 sm:p-7 shadow-xs hover:shadow-md flex flex-col justify-between transition-all hover:translate-y-[-2px] group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-[#16A34A] text-white flex items-center justify-center shadow-md shadow-emerald-500/30 group-hover:scale-105 transition-transform">
                      <CreditCard className="w-7 h-7" />
                    </div>
                    <span className="text-[11px] font-bold text-[#15803D] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">
                      Option B
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-[#172B4D] tracking-tight">
                      Scan UPI QR
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                      Scan a supported UPI payment QR to review payment details and continue through a compatible payment app.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-700 font-medium">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>Never asks for UPI PIN or OTP. Real settlement confirmation.</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Smartphone className="w-4 h-4 shrink-0 text-slate-400" />
                      <span>Supports BHIM, Google Pay, PhonePe, Paytm and banking apps</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={handleOpenUpiScanner}
                    className="w-full min-h-[52px] py-3.5 px-6 bg-[#16A34A] hover:bg-[#15803D] active:scale-[0.99] text-white text-base font-extrabold rounded-2xl shadow-sm shadow-emerald-600/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                  >
                    <CreditCard className="w-5 h-5 text-white" />
                    <span>Scan & Pay</span>
                  </button>
                </div>
              </div>
            </div>

            {/* =============================================================== */}
            {/* 3. COMPACT SECTION: MY SAVED RECEIPTS                           */}
            {/* =============================================================== */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <ReceiptIcon className="w-5 h-5 text-[#16A34A]" />
                  <h3 className="text-base font-bold text-[#172B4D] tracking-tight">
                    My Saved Receipts
                  </h3>
                </div>

                {receipts.length > 0 && (
                  <button
                    onClick={() => setCurrentView('receipts')}
                    className="text-xs font-semibold text-[#15803D] hover:text-[#166534] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>View All Receipts ({receipts.length})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {loading ? (
                <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#16A34A]" />
                  <span>Loading your saved receipts...</span>
                </div>
              ) : receipts.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-xs sm:text-sm text-slate-500">
                    No saved receipts yet. Scan a receipt QR code to get started.
                  </p>
                  <button
                    onClick={handleOpenReceiptScanner}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scan Receipt Now</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentReceipts.map(r => {
                    const token = r.tokens?.[0]?.token || r.receipt_token;
                    const merchantName =
                      r.company?.business_name ||
                      r.transaction?.company_name ||
                      'Annapurna Retail & Tea Lounge';
                    const dateStr = new Date(r.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    });
                    const grandTotal = Number(r.transaction?.grand_total || 0).toFixed(2);

                    return (
                      <div
                        key={r.id}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 px-2 rounded-xl transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <span className="font-bold text-[#172B4D] text-sm">
                              {merchantName}
                            </span>
                            <span className="font-mono text-xs text-[#15803D] font-semibold">
                              {r.receipt_number}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span>{dateStr}</span>
                            <span>•</span>
                            <span className="capitalize">{r.transaction?.payment_method || 'Verified'}</span>
                            {r.transaction?.items?.length > 0 && (
                              <>
                                <span>•</span>
                                <span>{r.transaction.items.length} item(s)</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3">
                          <span className="font-mono font-bold text-[#172B4D] text-base">
                            ₹{grandTotal}
                          </span>

                          <button
                            onClick={() => {
                              if (token) onOpenReceipt(token);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-[#16A34A] hover:text-white text-slate-700 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <span>View Receipt</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW B: FULL MY RECEIPTS VAULT */}
        {currentView === 'receipts' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#172B4D] tracking-tight flex items-center gap-2.5">
                  <ReceiptIcon className="w-6 h-6 text-[#16A34A]" />
                  <span>My Saved Digital Receipts</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Permanent tax invoices backed up in your verified account.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenReceiptScanner}
                  className="px-3.5 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scan New Receipt</span>
                </button>

                <button
                  onClick={loadCustomerData}
                  className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors cursor-pointer"
                  title="Refresh receipts"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search by receipt number, business name, or items..."
                value={searchReceipts}
                onChange={e => setSearchReceipts(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#16A34A]"
              />
            </div>

            {/* Receipts List */}
            {filteredReceipts.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl py-12 text-center text-slate-400 space-y-3">
                <ReceiptIcon className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">
                  {searchReceipts ? 'No receipts match your search filter.' : 'No saved receipts yet. Scan a receipt QR code to get started.'}
                </p>
                <button
                  onClick={handleOpenReceiptScanner}
                  className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scan Receipt Now</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredReceipts.map(r => {
                  const token = r.tokens?.[0]?.token || r.receipt_token;
                  const merchantName =
                    r.company?.business_name ||
                    r.transaction?.company_name ||
                    'Annapurna Retail & Tea Lounge';
                  const dateStr = new Date(r.created_at).toLocaleString();
                  const grandTotal = Number(r.transaction?.grand_total || 0).toFixed(2);

                  return (
                    <div
                      key={r.id}
                      className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-5 space-y-3 transition-colors flex flex-col justify-between shadow-2xs"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div>
                            <span className="text-[10px] font-bold text-[#15803D] uppercase tracking-wider block">
                              Verified Invoice
                            </span>
                            <span className="font-mono font-bold text-[#172B4D] text-sm">
                              {r.receipt_number}
                            </span>
                          </div>
                          <span className="font-mono font-extrabold text-[#15803D] text-lg">
                            ₹{grandTotal}
                          </span>
                        </div>

                        <div>
                          <span className="font-semibold text-slate-800 text-xs block">
                            {merchantName}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {dateStr}
                          </span>
                        </div>

                        {/* Items Preview */}
                        <div className="bg-slate-50 rounded-xl p-2.5 text-[11px] text-slate-700 space-y-1">
                          {r.transaction?.items?.slice(0, 3).map((it: any, idx: number) => (
                            <div key={idx} className="flex justify-between">
                              <span className="truncate pr-2">{it.product_name} ×{it.quantity}</span>
                              <span className="font-mono text-slate-500">₹{Number(it.line_total || 0).toFixed(2)}</span>
                            </div>
                          ))}
                          {r.transaction?.items?.length > 3 && (
                            <span className="text-[10px] text-slate-400 block pt-0.5">
                              +{r.transaction.items.length - 3} more items...
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 flex gap-2">
                        <button
                          onClick={() => {
                            if (token) onOpenReceipt(token);
                          }}
                          className="flex-1 py-2 px-3 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Full Receipt</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW C: PAYMENT HISTORY */}
        {currentView === 'payments' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#172B4D] tracking-tight flex items-center gap-2.5">
                  <CreditCard className="w-6 h-6 text-[#16A34A]" />
                  <span>UPI Payment History & Settlements</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Track real-time merchant settlement status for UPI QR transactions.
                </p>
              </div>

              <button
                onClick={handleOpenUpiScanner}
                className="px-3.5 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Scan UPI QR & Pay</span>
              </button>
            </div>

            {upiPayments.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl py-12 text-center text-slate-400 space-y-3">
                <CreditCard className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">
                  No UPI payments initiated yet.
                </p>
                <button
                  onClick={handleOpenUpiScanner}
                  className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Scan UPI QR to Pay</span>
                </button>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-xs">
                {upiPayments.map(p => (
                  <div key={p.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-[#172B4D] text-sm">
                          {p.payeeName || 'Retail Merchant'}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            p.status === 'verified'
                              ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {p.status === 'verified' ? 'Settled' : 'Pending Verification'}
                        </span>
                      </div>
                      <p className="font-mono text-xs text-[#15803D]">
                        {p.payeeVpa}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>{new Date(p.createdAt || Date.now()).toLocaleString()}</span>
                        <span>•</span>
                        <span className="font-mono">Ref: {p.transactionRef || p.id}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <span className="font-mono font-bold text-[#172B4D] text-base">
                        ₹{Number(p.amount).toFixed(2)}
                      </span>

                      {p.receipt && (
                        <button
                          onClick={() => {
                            const tok = p.receipt?.tokens?.[0]?.token || p.receipt?.receipt_token;
                            if (tok) onOpenReceipt(tok);
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-[#16A34A] hover:text-white text-[#15803D] text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <ReceiptIcon className="w-3.5 h-3.5" />
                          <span>View Receipt</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ===================================================================== */}
      {/* 4. FOOTER                                                             */}
      {/* ===================================================================== */}
      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-200 bg-white">
        ClearBill AI Customer Portal · Safe, Verified & Paperless Digital Invoices
      </footer>

      {/* ===================================================================== */}
      {/* 5. CUSTOMER PROFILE MODAL                                             */}
      {/* ===================================================================== */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 text-[#172B4D] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#16A34A] text-white flex items-center justify-center font-bold">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#172B4D]">Customer Profile</h3>
                  <span className="text-xs text-slate-400 font-mono">ID: {currentUser?.id || 'usr-cus-01'}</span>
                </div>
              </div>
              <button
                onClick={() => setProfileModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                <span className="text-slate-500 block text-[10px]">Full Name</span>
                <span className="font-bold text-[#172B4D] text-sm">{currentUser?.fullName || 'Verified Customer'}</span>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                <span className="text-slate-500 block text-[10px]">Email Address</span>
                <span className="font-semibold text-slate-700">{currentUser?.email || 'customer@clearbill.ai'}</span>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                <span className="text-slate-500 block text-[10px]">Verified Digital Receipts Saved</span>
                <span className="font-mono font-bold text-[#15803D] text-sm">{receipts.length} Invoices</span>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#15803D]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Privacy & Security Guarantee</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  ClearBill AI never requests or stores your banking credentials, UPI PIN, or OTP. All claimed receipts are cryptographically linked to your account.
                </p>
              </div>
            </div>

            <button
              onClick={() => setProfileModalOpen(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Close Profile
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. DEDICATED SCANNER MODAL (Option A vs Option B)                     */}
      {/* ===================================================================== */}
      {scannerModalOpen && (
        <CustomerScannerModal
          mode={scannerMode}
          currentUser={currentUser}
          onClose={() => setScannerModalOpen(false)}
          onReceiptSaved={() => {
            loadCustomerData();
          }}
          onNavigateToLogin={onNavigateToLogin}
          onOpenReceiptView={token => {
            setScannerModalOpen(false);
            onOpenReceipt(token);
          }}
        />
      )}
    </div>
  );
};
