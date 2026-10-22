/**
 * ClearBill AI - Core Reusable Layout Component
 * Dark Navy Sidebar (#172033), Light Clean Content (#F7F9FC), Top Bar Contract.
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Receipt,
  ScanLine,
  Zap,
  Package,
  Layers,
  CreditCard,
  QrCode,
  Scale,
  Leaf,
  BarChart3,
  Bot,
  Users,
  Sliders,
  Database,
  LogOut,
  Menu,
  X,
  Bell,
  Store as StoreIcon,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';
import { User, Company, Outlet, DbStatus } from '../../types.ts';
import { AiChatbotWidget } from '../AiChatbotWidget.tsx';

interface AppLayoutProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  currentUser: User | null;
  currentCompany: Company | null;
  currentOutlet: Outlet | null;
  dbStatus: DbStatus | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  currentCompany,
  currentOutlet,
  dbStatus,
  onLogout,
  children,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  const role = currentUser?.role || 'retailer';

  // Navigation items strictly filtered by authorized role
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['manager', 'retailer', 'customer'] },
    { id: 'new-bill', label: 'New Bill', icon: Receipt, roles: ['manager', 'retailer'] },
    { id: 'quick-bill', label: 'Quick Bill', icon: Zap, roles: ['manager', 'retailer'] },
    { id: 'barcode-scanner', label: 'Barcode Scanner', icon: ScanLine, roles: ['manager', 'retailer'] },
    { id: 'products', label: 'Products', icon: Package, roles: ['manager', 'retailer'] },
    { id: 'transactions', label: 'Transactions', icon: Layers, roles: ['manager', 'retailer'] },
    { id: 'payments', label: 'Payments', icon: CreditCard, roles: ['manager', 'retailer'] },
    { id: 'digital-receipts', label: 'Digital Receipts', icon: QrCode, roles: ['manager', 'retailer', 'customer'] },
    { id: 'reconciliation', label: 'Reconciliation', icon: Scale, roles: ['manager'] },
    { id: 'sustainability', label: 'Sustainability', icon: Leaf, roles: ['manager', 'retailer', 'customer'] },
    { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['manager'] },
    { id: 'ai-assistant', label: 'AI Assistant', icon: Bot, roles: ['manager', 'retailer', 'customer'] },
    { id: 'employees', label: 'Employees', icon: Users, roles: ['manager'] },
    { id: 'billing-fields', label: 'Billing Fields', icon: Sliders, roles: ['manager'] },
    { id: 'db-status', label: 'Database & XAMPP', icon: Database, roles: ['manager', 'retailer'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(role));

  const pageTitleMap: Record<string, string> = {
    dashboard: role === 'manager' ? 'Manager Overview & KPIs' : 'Retailer Cashier POS',
    'new-bill': 'Standard Retail Billing Engine',
    'quick-bill': 'Quick Bill Mode (Tea Shop & Express)',
    'barcode-scanner': 'Live Physical Barcode Scanner',
    products: 'Product Catalogue & Price Management',
    transactions: 'Transaction Ledger & Invoices',
    payments: 'Payment Gateways & Settlements',
    'digital-receipts': 'Digital Receipt Generator & QR Vault',
    reconciliation: 'Payment Reconciliation & Shortages',
    sustainability: 'Paper Reduction & ESG Impact',
    reports: 'Business Analytics & Tax Exports',
    'ai-assistant': 'ClearBill AI Retail Assistant',
    employees: 'Employee Roles & Outlets',
    'billing-fields': 'Customize Billing Interface Fields',
    'db-status': 'MySQL & XAMPP Database Connection',
  };

  return (
    <div className="flex h-screen bg-[#F7F9FC] text-[#172B4D] overflow-hidden">
      {/* 1. DESKTOP SIDEBAR (Dark Navy #172033) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-[#172033] text-[#E2E8F0] border-r border-[#263449] shrink-0">
        {/* Brand Zone */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[#263449]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#16A34A] flex items-center justify-center text-white shadow-xs">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white block leading-tight">ClearBill AI</span>
              <span className="text-[10px] text-[#94A3B8] block">Simple · Fast · Digital</span>
            </div>
          </div>
        </div>

        {/* Store / Outlet Context */}
        <div className="px-4 py-3 bg-[#131B2B] border-b border-[#263449]">
          <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
            <StoreIcon className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
            <div className="truncate">
              <span className="text-white font-medium block truncate">
                {currentCompany?.business_name || 'Annapurna Retail & Tea'}
              </span>
              <span className="text-[11px] text-[#64748B]">
                {currentOutlet?.outlet_code || 'BLR-01'} · {currentOutlet?.outlet_name || 'Flagship Outlet'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {filteredNavItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#16A34A] text-white shadow-xs font-semibold'
                    : 'text-[#E2E8F0] hover:bg-[#263449] hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#94A3B8]'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Database Status Mini Pill in Sidebar */}
        <div className="p-3 border-t border-[#263449] bg-[#131B2B]">
          <div
            onClick={() => onSelectTab('db-status')}
            className="cursor-pointer flex items-center justify-between p-2 rounded-md hover:bg-[#1E293B] transition-colors"
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  dbStatus?.isConnected ? 'bg-[#16A34A]' : 'bg-[#D97706]'
                }`}
              />
              <span className="text-[11px] text-[#CBD5E1]">
                {dbStatus?.isConnected ? 'MySQL XAMPP Live' : 'Local Fallback (28 Tables)'}
              </span>
            </div>
            <ExternalLink className="w-3 h-3 text-[#64748B]" />
          </div>
        </div>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-[#263449] flex items-center justify-between bg-[#172033]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-[#263449] text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
              {currentUser?.fullName?.[0] || 'U'}
            </div>
            <div className="truncate text-left">
              <span className="text-xs font-medium text-white block truncate">{currentUser?.fullName || 'User'}</span>
              <span className="text-[10px] text-[#94A3B8] uppercase block tracking-wider font-semibold">
                {currentUser?.role || 'Retailer'}
              </span>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Log Out"
            className="p-1.5 text-[#94A3B8] hover:text-white hover:bg-[#263449] rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* 2. MOBILE DRAWER OVERLAY */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/60" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative flex flex-col w-72 bg-[#172033] text-[#E2E8F0] shadow-xl z-50">
            <div className="h-16 flex items-center justify-between px-5 border-b border-[#263449]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#16A34A] flex items-center justify-center text-white">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-white">ClearBill AI</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-[#94A3B8] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {filteredNavItems.map(item => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium ${
                      isActive ? 'bg-[#16A34A] text-white font-semibold' : 'text-[#E2E8F0] hover:bg-[#263449]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-[#263449]">
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-300 hover:bg-[#263449] rounded-lg"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN WORKSPACE VIEWPORT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F7F9FC]">
        {/* TOP HEADER (White #FFFFFF, Border #E2E8F0) */}
        <header className="h-16 bg-white border-b border-[#E2E8F0] px-6 flex items-center justify-between gap-4 shrink-0 shadow-xs">
          {/* Zone 1: Title & Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                <span>ClearBill</span>
                <span>/</span>
                <span className="capitalize">{role}</span>
              </div>
              <h1 className="text-base font-bold text-[#172B4D] truncate leading-tight">
                {pageTitleMap[currentTab] || 'Dashboard'}
              </h1>
            </div>
          </div>

          {/* Zone 2: Navigation Shortcuts & Quick Actions */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => onSelectTab('quick-bill')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                currentTab === 'quick-bill'
                  ? 'bg-[#DCFCE7] text-[#15803D]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Quick Bill</span>
            </button>
            <button
              onClick={() => onSelectTab('barcode-scanner')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                currentTab === 'barcode-scanner'
                  ? 'bg-[#DCFCE7] text-[#15803D]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <ScanLine className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Barcode Scanner</span>
            </button>
            <button
              onClick={() => onSelectTab('new-bill')}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D] transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>+ New Bill</span>
            </button>
          </div>

          {/* Zone 3: Account Profile & Notifications */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationModal(!showNotificationModal)}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg relative transition-colors"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#16A34A] rounded-full" />
              </button>

              {showNotificationModal && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg p-4 z-50 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <span className="font-semibold text-slate-900">Notifications</span>
                    <span className="text-[11px] text-slate-500">All caught up</span>
                  </div>
                  <div className="space-y-2">
                    <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100 text-slate-800">
                      <p className="font-medium text-emerald-800">100% Digital Receipts Enabled</p>
                      <p className="text-[11px] text-slate-600">Saved 42 thermal paper rolls this month across all outlets.</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-700">
                      <p className="font-medium">Camera Barcode Scanner Ready</p>
                      <p className="text-[11px] text-slate-500">Supports EAN-13, EAN-8, UPC-A, and Code 128 barcodes.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">
                {currentUser?.fullName?.[0] || 'U'}
              </div>
              <div className="hidden sm:block text-left">
                <span className="text-xs font-semibold text-slate-900 block leading-none">
                  {currentUser?.fullName || 'Cashier'}
                </span>
                <span className="text-[10px] text-slate-500 capitalize">{role}</span>
              </div>
            </div>
          </div>
        </header>

        {/* MAIN SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F7F9FC]">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>

        {/* Floating Personalized Real-Time AI Chatbot Widget */}
        <AiChatbotWidget
          currentUser={currentUser}
          currentCompany={currentCompany}
          currentOutlet={currentOutlet}
        />
      </div>
    </div>
  );
};
