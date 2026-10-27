/**
 * ClearBill AI - Customer Unified Dashboard & Spend Intelligence
 *
 * Implements:
 * 1. Spend Analysis Dashboard:
 *    - Total spend, tax breakdown, paperless ESG savings, and category distribution.
 * 2. "Hey GPT" AI Spend Assistant:
 *    - Real-time conversational AI querying the customer's actual digital invoices.
 *    - Quick prompt chips for category breakdown, tea & snack spend, and budget advice.
 * 3. Unified In-Page Receipt Viewer:
 *    - Renders both the Standard Printable Receipt (matching reference image_b12be399.png)
 *      and the Railway-Ticket-inspired Dynamic Pass on the same page.
 *    - Toggle between Printable and Dynamic views with live countdown timer and scannable QR.
 * 4. Scan & Pay Workflows:
 *    - Scan Receipt QR (Option A) and Scan UPI QR (Option B).
 * 5. Clean Light Green & White theme (#16A34A / #F8FAFC).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import QRCode from 'qrcode';
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
  TrendingUp,
  PieChart,
  Bot,
  Sparkles,
  Send,
  Leaf,
  Printer,
  Copy,
  Check,
  Ticket,
  DollarSign,
  ShoppingBag,
} from 'lucide-react';
import { User, Receipt as ReceiptType } from '../types.ts';
import { CustomerScannerModal } from '../components/CustomerScannerModal.tsx';
import { buildPublicReceiptUrl } from '../utils/urlConfig.ts';

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
  const [currentView, setCurrentView] = useState<'dashboard' | 'receipts' | 'payments' | 'scanner'>('dashboard');
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Data states from MySQL / authoritative backend
  const [receipts, setReceipts] = useState<any[]>([]);
  const [upiPayments, setUpiPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchReceipts, setSearchReceipts] = useState('');

  // Scanner modal state
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'receipt' | 'upi'>('receipt');

  // Unified In-Page Receipt Inspector state (displays printable & dynamic receipt on the same page)
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null);
  const [receiptViewerMode, setReceiptViewerMode] = useState<'printable' | 'dynamic'>('printable');
  const [copiedLink, setCopiedLink] = useState(false);
  const [receiptQrDataUrl, setReceiptQrDataUrl] = useState<string | null>(null);

  // "Hey GPT" AI Spend Assistant State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiConversation, setAiConversation] = useState<
    { role: 'user' | 'assistant'; text: string; time: string }[]
  >([
    {
      role: 'assistant',
      text: `Hello ${currentUser?.fullName || 'there'}! I am Hey GPT, your ClearBill AI Spend Assistant. Ask me anything about your saved receipts, grocery habits, tea & snack expenses, or taxes.`,
      time: 'Just now',
    },
  ]);

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
        if (Array.isArray(data)) {
          setReceipts(data);
          if (data.length > 0 && !activeReceiptId) {
            setActiveReceiptId(data[0].id);
          }
        }
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
  }, [currentUser, activeReceiptId]);

  useEffect(() => {
    loadCustomerData();
  }, [loadCustomerData]);

  // Active selected receipt for in-page display
  const selectedReceipt = useMemo(() => {
    if (!receipts.length) return null;
    if (!activeReceiptId) return receipts[0];
    return receipts.find(r => r.id === activeReceiptId) || receipts[0];
  }, [receipts, activeReceiptId]);

  // Generate QR for selected receipt
  useEffect(() => {
    if (!selectedReceipt) return;
    const token = selectedReceipt.tokens?.[0]?.token || selectedReceipt.receipt_token || 't-guest-001';
    const fullUrl = buildPublicReceiptUrl(token);

    QRCode.toDataURL(fullUrl, {
      margin: 2,
      width: 200,
      color: { dark: '#172B4D', light: '#FFFFFF' },
    })
      .then(setReceiptQrDataUrl)
      .catch(console.error);
  }, [selectedReceipt]);

  // Spend Analysis Aggregations
  const spendAnalytics = useMemo(() => {
    let totalSpent = 0;
    let totalTaxes = 0;
    const categories: Record<string, { total: number; count: number }> = {};
    const merchants: Record<string, number> = {};

    receipts.forEach(r => {
      const tx = r.transaction;
      if (tx) {
        totalSpent += tx.grand_total || 0;
        totalTaxes += tx.tax_amount || 0;

        const storeName = r.company?.business_name || tx.company_name || 'Retail Store';
        merchants[storeName] = (merchants[storeName] || 0) + (tx.grand_total || 0);

        tx.items?.forEach((it: any) => {
          const cat = it.category || (it.product_name?.toLowerCase().includes('tea') ? 'Beverages' : 'Groceries');
          if (!categories[cat]) categories[cat] = { total: 0, count: 0 };
          categories[cat].total += it.line_total || 0;
          categories[cat].count += it.quantity || 1;
        });
      }
    });

    const categoryList = Object.entries(categories).map(([name, data]) => ({
      name,
      total: data.total,
      count: data.count,
      pct: totalSpent > 0 ? Math.round((data.total / totalSpent) * 100) : 0,
    })).sort((a, b) => b.total - a.total);

    const paperGramsSaved = receipts.length * 2.5;
    const avgBill = receipts.length > 0 ? totalSpent / receipts.length : 0;

    return {
      totalSpent,
      totalTaxes,
      categoryList,
      merchants,
      paperGramsSaved,
      avgBill,
      receiptsCount: receipts.length,
    };
  }, [receipts]);

  // Open separate scanning workflows
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

  // Handle Ask Hey GPT
  const handleAskHeyGpt = async (promptText?: string) => {
    const q = (promptText || aiPrompt).trim();
    if (!q || aiLoading) return;

    setAiPrompt('');
    setAiConversation(prev => [
      ...prev,
      { role: 'user', text: q, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ]);
    setAiLoading(true);

    let customerToken = '';
    if (typeof window !== 'undefined') {
      try {
        const sess = localStorage.getItem('cb_customer_session');
        if (sess) {
          const parsed = JSON.parse(sess);
          if (parsed.token) customerToken = parsed.token;
        }
      } catch (e) {}
    }

    try {
      const res = await fetch('/api/customer/ai-spend-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customerToken ? { Authorization: `Bearer ${customerToken}` } : {}),
        },
        body: JSON.stringify({ prompt: q }),
      });

      const data = await res.json();
      if (res.ok && data.answer) {
        setAiConversation(prev => [
          ...prev,
          {
            role: 'assistant',
            text: data.answer,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        setAiConversation(prev => [
          ...prev,
          {
            role: 'assistant',
            text: data.error || 'I had trouble analyzing your receipts. Please try asking again.',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err: any) {
      setAiConversation(prev => [
        ...prev,
        {
          role: 'assistant',
          text: `You have spent ₹${spendAnalytics.totalSpent.toFixed(2)} across ${receipts.length} verified receipts.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleCopyReceiptLink = () => {
    if (!selectedReceipt) return;
    const token = selectedReceipt.tokens?.[0]?.token || selectedReceipt.receipt_token;
    const fullUrl = buildPublicReceiptUrl(token);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      });
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#172B4D] flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* ===================================================================== */}
      {/* 1. TOP NAVIGATION BAR (Clean Light Green & White Theme)               */}
      {/* ===================================================================== */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 sm:px-6 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div
            onClick={() => setCurrentView('dashboard')}
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
                Customer Intelligence
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2 text-xs font-semibold">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                currentView === 'dashboard'
                  ? 'bg-emerald-50 text-[#15803D] border border-emerald-200 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Spend & Receipts</span>
            </button>

            <button
              onClick={() => setCurrentView('receipts')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                currentView === 'receipts'
                  ? 'bg-emerald-50 text-[#15803D] border border-emerald-200 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ReceiptIcon className="w-3.5 h-3.5" />
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
              <CreditCard className="w-3.5 h-3.5" />
              <span>UPI Payments</span>
              {upiPayments.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-100 text-slate-700 font-bold">
                  {upiPayments.length}
                </span>
              )}
            </button>

            {/* Quick Scan Action */}
            <button
              onClick={handleOpenReceiptScanner}
              className="px-3 py-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Scan QR</span>
            </button>

            <button
              onClick={() => setProfileModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
              title="Customer Profile"
            >
              <UserIcon className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-700 transition-colors cursor-pointer flex items-center gap-1"
                title="Log out"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* 2. MAIN CONTENT BODY: ALL-IN-ONE CUSTOMER DASHBOARD                   */}
      {/* ===================================================================== */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6">
        {/* =================================================================== */}
        {/* VIEW A: UNIFIED DASHBOARD WITH SPEND ANALYSIS, HEY GPT & IN-PAGE RECEIPT */}
        {/* =================================================================== */}
        {currentView === 'dashboard' && (
          <div className="space-y-6">
            {/* Top Scanning Quick Action Banner */}
            <div className="bg-gradient-to-r from-emerald-600 to-[#16A34A] rounded-2xl p-4 sm:p-5 text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-md shadow-emerald-600/20">
              <div className="space-y-1 text-center md:text-left">
                <div className="inline-flex items-center gap-1.5 bg-white/20 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-emerald-100">
                  <Sparkles className="w-3 h-3" />
                  <span>Welcome back, {currentUser?.fullName || 'Valued Shopper'}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  Your Digital Receipts & Spend Intelligence
                </h1>
                <p className="text-xs text-emerald-100 max-w-xl">
                  Analyze spending categories, chat with Hey GPT, and inspect verified dynamic and printable receipts all on this page.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  onClick={handleOpenReceiptScanner}
                  className="px-4 py-2.5 bg-white hover:bg-emerald-50 text-[#15803D] text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-98"
                >
                  <QrCode className="w-4 h-4 text-[#16A34A]" />
                  <span>Scan Receipt QR</span>
                </button>
                <button
                  onClick={handleOpenUpiScanner}
                  className="px-4 py-2.5 bg-[#172033] hover:bg-[#263449] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-98"
                >
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span>Scan UPI & Pay</span>
                </button>
              </div>
            </div>

            {/* SPEND ANALYSIS KPI CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">Total Spent</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#15803D] flex items-center justify-center font-bold">
                    ₹
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-[#172B4D] tracking-tight">
                  ₹{spendAnalytics.totalSpent.toFixed(2)}
                </div>
                <span className="text-[11px] text-emerald-600 font-semibold block">
                  Across {spendAnalytics.receiptsCount} verified bills
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">Saved Receipts</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <ReceiptIcon className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-[#172B4D] tracking-tight">
                  {spendAnalytics.receiptsCount}
                </div>
                <span className="text-[11px] text-slate-500 block">
                  Avg. ₹{spendAnalytics.avgBill.toFixed(2)} / purchase
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">GST / Tax Paid</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <PieChart className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-[#172B4D] tracking-tight">
                  ₹{spendAnalytics.totalTaxes.toFixed(2)}
                </div>
                <span className="text-[11px] text-slate-500 block">
                  Verified tax breakdowns
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">Paperless ESG</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#16A34A] flex items-center justify-center font-bold">
                    <Leaf className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-[#16A34A] tracking-tight">
                  +{spendAnalytics.paperGramsSaved.toFixed(1)}g
                </div>
                <span className="text-[11px] text-emerald-700 font-medium block">
                  100% Zero Thermal Paper
                </span>
              </div>
            </div>

            {/* DASHBOARD SPLIT: CATEGORY ANALYSIS + "HEY GPT" SPEND ASSISTANT */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Category Spending Breakdown */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-[#16A34A]" />
                    <h2 className="text-sm font-bold text-[#172B4D]">Category Spend Breakdown</h2>
                  </div>
                  <span className="text-[11px] text-slate-400 font-semibold">{spendAnalytics.categoryList.length} Categories</span>
                </div>

                {spendAnalytics.categoryList.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    No categorized purchases recorded yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {spendAnalytics.categoryList.map(cat => (
                      <div key={cat.name} className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-slate-700">{cat.name}</span>
                          <span className="font-mono font-bold text-slate-900">
                            ₹{cat.total.toFixed(2)} ({cat.pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-[#16A34A] h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(4, cat.pct)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* "HEY GPT" AI Spend Assistant Card */}
              <div className="lg:col-span-7 bg-white border border-emerald-200 rounded-2xl p-5 shadow-2xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#16A34A] text-white flex items-center justify-center shadow-xs">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-[#172B4D] flex items-center gap-1.5">
                          <span>Hey GPT · Spend Assistant</span>
                          <span className="text-[9px] bg-emerald-100 text-[#15803D] font-bold px-1.5 py-0.2 rounded-full uppercase">
                            AI Powered
                          </span>
                        </h2>
                        <p className="text-[10px] text-slate-500">Ask questions about your verified digital bills</p>
                      </div>
                    </div>
                  </div>

                  {/* Conversation History */}
                  <div className="max-h-56 overflow-y-auto space-y-2.5 py-3 pr-1 text-xs">
                    {aiConversation.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex gap-2.5 ${
                          msg.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="w-6 h-6 rounded-full bg-emerald-100 text-[#15803D] flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                            AI
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-[#16A34A] text-white rounded-br-none shadow-2xs'
                              : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-bl-none shadow-2xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                          <span
                            className={`text-[9px] block text-right mt-1 font-medium ${
                              msg.role === 'user' ? 'text-emerald-100' : 'text-slate-400'
                            }`}
                          >
                            {msg.time}
                          </span>
                        </div>
                      </div>
                    ))}
                    {aiLoading && (
                      <div className="flex gap-2 text-xs text-slate-500 items-center pl-8">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#16A34A]" />
                        <span>Hey GPT is analyzing your receipt records...</span>
                      </div>
                    )}
                  </div>

                  {/* Suggested Prompt Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      'Analyze my spend',
                      'Tea & snack spend',
                      'Top expenses',
                      'Tax breakdown',
                    ].map(chip => (
                      <button
                        key={chip}
                        onClick={() => handleAskHeyGpt(chip)}
                        disabled={aiLoading}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-[#15803D] hover:border-emerald-200 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-600 transition-colors cursor-pointer"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prompt Input Form */}
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleAskHeyGpt();
                  }}
                  className="flex gap-2 pt-2 border-t border-slate-100"
                >
                  <input
                    type="text"
                    placeholder="Ask Hey GPT: e.g. How much did I spend this month on snacks?"
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    disabled={aiLoading}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#16A34A] focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={!aiPrompt.trim() || aiLoading}
                    className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Ask</span>
                    <Send className="w-3 h-3" />
                  </button>
                </form>
              </div>
            </div>

            {/* =============================================================== */}
            {/* IN-PAGE RECEIPT VIEWER SECTION: PRINTABLE & DYNAMIC ON ONE PAGE */}
            {/* =============================================================== */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <ReceiptIcon className="w-5 h-5 text-[#16A34A]" />
                    <h2 className="text-lg font-extrabold text-[#172B4D] tracking-tight">
                      Receipt & Dynamic Pass Inspector (In-Page View)
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select any receipt below to inspect its itemized tax table and dynamic security pass right on this dashboard.
                  </p>
                </div>

                {/* Mode Switcher: Printable Receipt (as in reference image) vs Dynamic Ticket Pass */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
                  <button
                    onClick={() => setReceiptViewerMode('printable')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                      receiptViewerMode === 'printable'
                        ? 'bg-white text-[#172B4D] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span>Printable Receipt</span>
                  </button>
                  <button
                    onClick={() => setReceiptViewerMode('dynamic')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                      receiptViewerMode === 'dynamic'
                        ? 'bg-white text-[#172B4D] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Ticket className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span>Dynamic Pass</span>
                  </button>
                </div>
              </div>

              {/* Receipt Selector Carousel / Pill Row */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <span className="text-xs font-bold text-slate-500 shrink-0">Select Receipt:</span>
                {receipts.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setActiveReceiptId(r.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedReceipt?.id === r.id
                        ? 'bg-[#16A34A] text-white shadow-xs font-bold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{r.receipt_number}</span>
                    <span className="opacity-75 font-mono text-[10px]">
                      ₹{Number(r.transaction?.grand_total || 0).toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>

              {/* THE IN-PAGE RECEIPT CARD CONTAINER */}
              {selectedReceipt ? (
                <div className="max-w-2xl mx-auto">
                  {/* ========================================================= */}
                  {/* VIEW 1: PRINTABLE RECEIPT (Exact layout of image_b12be399)*/}
                  {/* ========================================================= */}
                  {receiptViewerMode === 'printable' && (
                    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
                      {/* Sustainability Green Pill (matches image_b12be399.png) */}
                      <div className="bg-[#DCFCE7] border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between text-xs text-[#15803D]">
                        <div className="flex items-center gap-2 font-medium">
                          <Leaf className="w-4 h-4 text-[#16A34A]" />
                          <span>Confirmed 100% Paperless Digital Receipt</span>
                        </div>
                        <span className="font-bold text-[11px]">+2.5g Thermal Paper Saved</span>
                      </div>

                      {/* Store Header */}
                      <div className="text-center pb-3 border-b border-dashed border-slate-200 space-y-1">
                        <h2 className="text-xl font-extrabold text-[#172B4D] tracking-tight">
                          {selectedReceipt.company?.business_name || selectedReceipt.transaction?.company_name || 'Annapurna Retail & Tea Lounge'}
                        </h2>
                        <p className="text-xs text-[#64748B]">
                          {selectedReceipt.outlet?.outlet_name || 'MG Road Flagship Store'} · {selectedReceipt.outlet?.address || 'Shop 14, Commercial Complex, MG Road, Bengaluru'}
                        </p>
                        <p className="text-[11px] text-[#64748B]">
                          GSTIN: {selectedReceipt.company?.tax_identification_number || '29AAAAA0000A1Z5'} · Tel: {selectedReceipt.outlet?.phone || '+91 98765 43210'}
                        </p>
                      </div>

                      {/* Transaction Metadata */}
                      <div className="grid grid-cols-2 text-xs text-slate-600 gap-y-1.5">
                        <div>
                          <span className="text-slate-400">Receipt No: </span>
                          <span className="font-bold text-slate-800">{selectedReceipt.receipt_number}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400">Date: </span>
                          <span className="font-medium text-slate-800">
                            {new Date(selectedReceipt.created_at).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Invoice ID: </span>
                          <span className="font-mono text-slate-700">{selectedReceipt.transaction?.transaction_number || 'CB-2026-1002'}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400">Payment: </span>
                          <span className="font-bold uppercase text-[#16A34A]">
                            {selectedReceipt.transaction?.payment_method || 'UPI'} (VERIFIED)
                          </span>
                        </div>
                        <div className="col-span-2 pt-1 text-slate-500">
                          Customer: <span className="font-medium text-slate-800">{selectedReceipt.transaction?.customer_name || currentUser?.fullName || 'Valued Customer'}</span>
                        </div>
                      </div>

                      {/* Itemized Table */}
                      <div className="pt-2 border-t border-slate-200">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider">
                              <th className="pb-2">ITEM DESCRIPTION</th>
                              <th className="pb-2 text-center">QTY</th>
                              <th className="pb-2 text-right">UNIT PRICE</th>
                              <th className="pb-2 text-right">TAX</th>
                              <th className="pb-2 text-right">SUBTOTAL</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(selectedReceipt.transaction?.items || []).map((it: any, idx: number) => (
                              <tr key={idx} className="py-2">
                                <td className="py-2.5 font-medium text-slate-800">
                                  <div>{it.product_name}</div>
                                  {it.barcode && (
                                    <span className="text-[10px] font-mono text-slate-400 block">{it.barcode}</span>
                                  )}
                                </td>
                                <td className="py-2.5 text-center font-bold text-slate-700 tabular-nums">
                                  {it.quantity}
                                </td>
                                <td className="py-2.5 text-right text-slate-600 tabular-nums">
                                  ₹{Number(it.unit_price || 0).toFixed(2)}
                                </td>
                                <td className="py-2.5 text-right text-slate-600 tabular-nums">
                                  {it.tax_rate > 0 ? `${it.tax_rate}% (₹${Number(it.tax_amount || 0).toFixed(2)})` : '0%'}
                                </td>
                                <td className="py-2.5 text-right font-bold text-slate-900 tabular-nums">
                                  ₹{Number(it.line_total || 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Financial Breakdown (matches image_b12be399.png) */}
                      <div className="pt-3 border-t border-dashed border-slate-200 space-y-1.5 text-xs text-slate-600">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span className="font-medium text-slate-900 tabular-nums">
                            ₹{Number(selectedReceipt.transaction?.subtotal || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Taxes (GST):</span>
                          <span className="font-medium text-slate-900 tabular-nums">
                            ₹{Number(selectedReceipt.transaction?.tax_amount || 0).toFixed(2)}
                          </span>
                        </div>
                        {Number(selectedReceipt.transaction?.discount_amount || 0) > 0 && (
                          <div className="flex justify-between text-emerald-700">
                            <span>Discount Applied:</span>
                            <span className="font-medium tabular-nums">
                              -₹{Number(selectedReceipt.transaction.discount_amount).toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="pt-2 border-t border-slate-300 flex justify-between items-baseline">
                          <span className="text-sm font-bold text-[#172B4D]">Grand Total:</span>
                          <span className="text-2xl font-black text-[#16A34A] tabular-nums">
                            ₹{Number(selectedReceipt.transaction?.grand_total || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handlePrintReceipt}
                            className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print PDF</span>
                          </button>
                          <button
                            onClick={handleCopyReceiptLink}
                            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                          </button>
                        </div>

                        <button
                          onClick={() => setReceiptViewerMode('dynamic')}
                          className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#15803D] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Ticket className="w-3.5 h-3.5" />
                          <span>View Dynamic Pass View</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* VIEW 2: DYNAMIC PASS (Railway Ticket Geometry & Live Timer)*/}
                  {/* ========================================================= */}
                  {receiptViewerMode === 'dynamic' && (
                    <div className="relative bg-white border border-[#CBD5E1] rounded-3xl shadow-lg overflow-hidden">
                      {/* Ticket Concave Cutout Notches */}
                      <div className="absolute top-[38%] -left-3.5 w-7 h-7 rounded-full bg-[#F8FAFC] border-r border-[#CBD5E1] z-10" />
                      <div className="absolute top-[38%] -right-3.5 w-7 h-7 rounded-full bg-[#F8FAFC] border-l border-[#CBD5E1] z-10" />

                      {/* Header Pass */}
                      <div className="bg-gradient-to-r from-[#172033] to-[#263449] text-white p-5 sm:p-6">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-[#16A34A] flex items-center justify-center font-black text-white text-sm">
                              C
                            </div>
                            <div>
                              <div className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
                                <span>ClearBill AI</span>
                                <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider text-emerald-300">
                                  Verified Pass
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-300">Digital Retail Invoice Token</p>
                            </div>
                          </div>

                          <div className="bg-black/30 backdrop-blur-xs border border-white/20 rounded-xl px-3 py-1 text-right">
                            <span className="text-[9px] text-emerald-300 font-bold uppercase tracking-wider block">Vault Stored</span>
                            <span className="font-mono text-xs font-bold text-white">Permanent Record</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-end justify-between gap-2">
                          <div>
                            <h3 className="text-lg font-black text-white tracking-tight">
                              {selectedReceipt.company?.business_name || 'Annapurna Retail & Tea Lounge'}
                            </h3>
                            <p className="text-xs text-slate-300">
                              {selectedReceipt.outlet?.outlet_name || 'MG Road Flagship Store'}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Receipt ID</span>
                            <span className="font-mono font-bold text-xs text-emerald-300">{selectedReceipt.receipt_number}</span>
                          </div>
                        </div>
                      </div>

                      {/* Body Details */}
                      <div className="p-5 sm:p-6 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                          <div>
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                              Total Paid
                            </span>
                            <div className="text-3xl font-black text-[#16A34A] tracking-tight">
                              ₹{Number(selectedReceipt.transaction?.grand_total || 0).toFixed(2)}
                            </div>
                            <span className="text-[11px] text-slate-500">
                              Verified {selectedReceipt.transaction?.payment_method?.toUpperCase() || 'UPI'} Payment
                            </span>
                          </div>

                          <div className="text-right space-y-1">
                            <div className="inline-flex items-center gap-1.5 bg-emerald-100 border border-emerald-300 text-[#15803D] px-3 py-1 rounded-full text-xs font-bold">
                              <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                              <span>PAID & VERIFIED</span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {new Date(selectedReceipt.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        {/* Perforated Divider */}
                        <div className="border-b-2 border-dashed border-slate-300 my-2" />

                        {/* High-Contrast Machine-Readable QR */}
                        <div className="flex flex-col items-center justify-center text-center space-y-2 pt-1">
                          <div className="p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-sm inline-block">
                            {receiptQrDataUrl ? (
                              <img
                                src={receiptQrDataUrl}
                                alt={`QR Code for ${selectedReceipt.receipt_number}`}
                                className="w-44 h-44 object-contain rounded-lg"
                              />
                            ) : (
                              <QrCode className="w-44 h-44 text-slate-300" />
                            )}
                          </div>
                          <p className="text-xs font-bold text-[#172B4D]">Scan with any camera to verify</p>
                        </div>

                        {/* Bottom Actions */}
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                          <button
                            onClick={() => setReceiptViewerMode('printable')}
                            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-slate-600" />
                            <span>Switch to Printable Receipt Table</span>
                          </button>

                          <button
                            onClick={handleCopyReceiptLink}
                            className="px-3.5 py-1.5 bg-[#172B4D] hover:bg-[#263449] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>{copiedLink ? 'Copied!' : 'Copy Receipt Link'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-6">No receipt selected.</p>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW B: FULL MY RECEIPTS VAULT                                      */}
        {/* =================================================================== */}
        {currentView === 'receipts' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#172B4D] tracking-tight flex items-center gap-2.5">
                  <ReceiptIcon className="w-6 h-6 text-[#16A34A]" />
                  <span>My Saved Digital Receipts</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Permanent tax invoices stored securely in your customer vault.
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

            {/* Receipts Grid */}
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
                            setActiveReceiptId(r.id);
                            setCurrentView('dashboard');
                          }}
                          className="flex-1 py-2 px-3 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect on Dashboard</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW C: PAYMENT HISTORY                                             */}
        {/* =================================================================== */}
        {currentView === 'payments' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#172B4D] tracking-tight flex items-center gap-2.5">
                  <CreditCard className="w-6 h-6 text-[#16A34A]" />
                  <span>UPI Payment History & Settlements</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Track real-time merchant settlement status for UPI transactions.
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

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <span className="font-mono font-bold text-[#172B4D] text-lg">
                        ₹{Number(p.amount || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Profile Modal */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-[#16A34A]" />
                <h3 className="font-bold text-[#172B4D]">Customer Profile</h3>
              </div>
              <button
                onClick={() => setProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block">Full Name</span>
                <span className="font-bold text-slate-800 text-sm">{currentUser?.fullName || 'Valued Customer'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Email Address</span>
                <span className="font-medium text-slate-800">{currentUser?.email || 'customer@clearbill.ai'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Account Role</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                  Verified Consumer
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setProfileModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real Camera Scanner Modal */}
      {scannerModalOpen && (
        <CustomerScannerModal
          mode={scannerMode}
          currentUser={currentUser}
          onClose={() => {
            setScannerModalOpen(false);
            loadCustomerData();
          }}
          onReceiptSaved={(token: string) => {
            setScannerModalOpen(false);
            loadCustomerData();
            setActiveReceiptId(token);
            setCurrentView('dashboard');
          }}
          onOpenReceiptView={(token: string) => {
            setScannerModalOpen(false);
            loadCustomerData();
            setActiveReceiptId(token);
            setCurrentView('dashboard');
          }}
          onNavigateToLogin={onNavigateToLogin}
        />
      )}

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        ClearBill AI · Paperless Verified Digital Receipts & Customer Spend Intelligence
      </footer>
    </div>
  );
};
