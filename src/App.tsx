/**
 * ClearBill AI - Main Application Entry & Secure Role-Based Router
 *
 * Implements strict role-based separation:
 * - Customer Portal: /customer/login, /customer/dashboard, /customer/receipts, /customer/receipts/:token, /customer/receipt-expired
 * - Retailer POS: /retailer/login, /retailer/pos, /retailer/billing, /retailer/dashboard
 * - Manager Dashboard: /manager/login, /manager/dashboard
 * - Public & Home: / (Landing Page), /receipt/:token (Public Guest Scannable Receipt)
 *
 * Enforces role isolation:
 * - Customers cannot access Retailer POS, Barcode Scanner, Quick Bill, or Manager screens.
 * - Expired receipt links show customer-friendly guidance without redirecting to Retailer Login or POS.
 * - Unauthenticated users start at Home Interface (not automatically logged in as Retailer).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { AuthModal } from './pages/AuthPages.tsx';
import { ManagerDashboard } from './pages/ManagerDashboard.tsx';
import { RetailerDashboard } from './pages/RetailerDashboard.tsx';
import { BillingScreen } from './pages/BillingScreen.tsx';
import { BarcodeScannerScreen } from './pages/BarcodeScannerScreen.tsx';
import { DigitalReceiptScreen } from './pages/DigitalReceiptScreen.tsx';
import { ProductCatalogue } from './pages/ProductCatalogue.tsx';
import { BillingFieldsCustomizer } from './pages/BillingFieldsCustomizer.tsx';
import { CustomerPortal } from './pages/CustomerPortal.tsx';
import { AdminDashboard } from './pages/AdminDashboard.tsx';
import { AiAssistantScreen } from './pages/AiAssistantScreen.tsx';
import { DatabaseStatusScreen } from './pages/DatabaseStatusScreen.tsx';
import { TransactionsLedger } from './pages/TransactionsLedger.tsx';
import { SustainabilityReport } from './pages/SustainabilityReport.tsx';
import { ReconciliationScreen } from './pages/ReconciliationScreen.tsx';
import { PaymentsScreen } from './pages/PaymentsScreen.tsx';
import { ReportsScreen } from './pages/ReportsScreen.tsx';
import { EmployeesScreen } from './pages/EmployeesScreen.tsx';
import { User, Company, Outlet, CartItem, Product, DbStatus } from './types.ts';
import {
  ShoppingBag,
  ShieldAlert,
  LogOut,
  Receipt,
  ArrowLeft,
  Home,
  Clock,
  AlertTriangle,
  User as UserIcon,
} from 'lucide-react';

export default function App() {
  // 1. Current URL Route Tracking
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
    return '/';
  });

  // 2. Authentication & Isolated Session State
  // Default to null for unauthenticated guests so it starts on the Home interface
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname || '/';

    // Check role-specific session storage based on requested URL
    try {
      if (path.startsWith('/customer')) {
        const sess = localStorage.getItem('cb_customer_session');
        if (sess) return JSON.parse(sess).user;
      } else if (path.startsWith('/admin')) {
        const sess = localStorage.getItem('cb_admin_session');
        if (sess) return JSON.parse(sess).user;
      } else if (path.startsWith('/manager')) {
        const sess = localStorage.getItem('cb_manager_session');
        if (sess) return JSON.parse(sess).user;
      } else if (path.startsWith('/retailer')) {
        const sess = localStorage.getItem('cb_retailer_session');
        if (sess) return JSON.parse(sess).user;
      } else {
        const anySess = localStorage.getItem('cb_customer_session') || localStorage.getItem('cb_retailer_session') || localStorage.getItem('cb_manager_session') || localStorage.getItem('cb_admin_session');
        if (anySess) return JSON.parse(anySess).user;
      }
    } catch (e) {
      console.warn('[ClearBill] Error restoring session:', e);
    }
    return null;
  });

  const [currentCompany, setCurrentCompany] = useState<Company | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const sess = localStorage.getItem('cb_retailer_session') || localStorage.getItem('cb_manager_session');
      if (sess) return JSON.parse(sess).company;
    } catch (e) {}
    return {
      id: 'cmp-demo-01',
      business_name: 'Annapurna Retail & Tea Lounge',
      category: 'grocery_store',
      owner_name: 'Rajesh Sharma',
      email: 'manager@clearbill.ai',
      phone: '+91 98765 43210',
      address: 'Shop 14, Commercial Complex, MG Road, Bengaluru',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      tax_identification_number: '29AAAAA0000A1Z5',
    };
  });

  const [currentOutlet, setCurrentOutlet] = useState<Outlet | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const sess = localStorage.getItem('cb_retailer_session') || localStorage.getItem('cb_manager_session');
      if (sess) return JSON.parse(sess).outlet;
    } catch (e) {}
    return {
      id: 'out-demo-01',
      company_id: 'cmp-demo-01',
      outlet_name: 'MG Road Flagship Store',
      outlet_code: 'BLR-01',
      address: 'Shop 14, Commercial Complex, MG Road, Bengaluru',
      phone: '+91 98765 43210',
    };
  });

  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);

  // Auth modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalRole, setAuthModalRole] = useState<'manager' | 'retailer' | 'customer'>('customer');
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Active cashier view vs customer view for digital receipts
  const [isCashierReceiptView, setIsCashierReceiptView] = useState(false);

  // Active digital receipt token to view
  const [activeReceiptToken, setActiveReceiptToken] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/receipt/')) {
        const tok = path.replace('/receipt/', '').split('/')[0].split('?')[0];
        if (tok) return tok;
      } else if (path.startsWith('/customer/receipts/')) {
        const tok = path.replace('/customer/receipts/', '').split('/')[0].split('?')[0];
        if (tok) return tok;
      }
      const params = new URLSearchParams(window.location.search);
      const qTok = params.get('receipt') || params.get('token');
      if (qTok) return qTok;
    }
    return 't-guest-001';
  });

  // Active Draft Bill / Cart state shared between Barcode Scanner and Billing Screen
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      product: {
        id: 'prod-qb-01',
        company_id: 'cmp-demo-01',
        product_name: 'Special Masala Tea',
        barcode: 'TEA-001',
        category: 'Beverages',
        unit: 'cup',
        unit_price: 15.0,
        tax_rate: 5.0,
        is_quick_bill_item: true,
        quick_bill_order: 1,
        is_active: true,
      },
      quantity: 2,
      discount: 0,
    },
    {
      product: {
        id: 'prod-qb-04',
        company_id: 'cmp-demo-01',
        product_name: 'Hot Samosa (2 pcs)',
        barcode: 'SAM-001',
        category: 'Snacks',
        unit: 'plate',
        unit_price: 30.0,
        tax_rate: 5.0,
        is_quick_bill_item: true,
        quick_bill_order: 4,
        is_active: true,
      },
      quantity: 1,
      discount: 0,
    },
  ]);

  // Tab state for Retailer/Manager sidebar
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Navigation Helper with History Push
  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', path);
    }
  }, []);

  // Sync route on popstate and initial mount
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === 'undefined') return;
      const p = window.location.pathname || '/';
      setCurrentPath(p);

      // Check for token in URL
      if (p.startsWith('/receipt/')) {
        const tok = p.replace('/receipt/', '').split('/')[0].split('?')[0];
        if (tok) {
          setActiveReceiptToken(tok);
          setIsCashierReceiptView(false);
        }
      } else if (p.startsWith('/customer/receipts/')) {
        const tok = p.replace('/customer/receipts/', '').split('/')[0].split('?')[0];
        if (tok) {
          setActiveReceiptToken(tok);
          setIsCashierReceiptView(false);
        }
      }
    };

    handlePopState();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch db status on mount
  useEffect(() => {
    fetch('/api/db/status')
      .then(r => r.json())
      .then(setDbStatus)
      .catch(console.error);
  }, []);

  // Handle Barcode Scanned
  const handleBarcodeProductAdd = (product: Product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, discount: 0 }];
    });
  };

  // Cashier POS Checkout -> Launches Cashier Receipt Screen with 30s Countdown
  const handleCheckoutSuccess = (receiptToken: string) => {
    setActiveReceiptToken(receiptToken);
    setIsCashierReceiptView(true);
    setCurrentTab('digital-receipts');
    navigateTo(`/receipt/${receiptToken}`);
  };

  // Memoized Back to Billing Handler for Cashier Station
  const handleBackToBilling = useCallback(() => {
    setIsCashierReceiptView(false);
    setCurrentTab('new-bill');
    navigateTo('/retailer/pos');
  }, [navigateTo]);

  // Role-Isolated Logout Handlers
  const handleCustomerLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cb_customer_session');
    }
    setCurrentUser(null);
    navigateTo('/customer/login');
  };

  const handleAdminLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cb_admin_session');
    }
    setCurrentUser(null);
    navigateTo('/');
  };

  const handleStaffLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cb_retailer_session');
      localStorage.removeItem('cb_manager_session');
      localStorage.removeItem('cb_admin_session');
    }
    const role = currentUser?.role || 'retailer';
    setCurrentUser(null);
    if (role === 'admin') {
      navigateTo('/');
    } else if (role === 'manager') {
      navigateTo('/manager/login');
    } else {
      navigateTo('/retailer/login');
    }
  };

  // Auth Success Handler
  const handleAuthSuccess = (user: User, company: Company, outlet: Outlet) => {
    setCurrentUser(user);
    if (company) setCurrentCompany(company);
    if (outlet) setCurrentOutlet(outlet);
    setAuthModalOpen(false);

    if (user.role === 'customer') {
      navigateTo('/customer/dashboard');
    } else if (user.role === 'admin') {
      navigateTo('/admin/dashboard');
    } else if (user.role === 'manager') {
      setCurrentTab('dashboard');
      navigateTo('/manager/dashboard');
    } else {
      setCurrentTab('new-bill');
      navigateTo('/retailer/pos');
    }
  };

  // =========================================================================
  // ROUTING & ACCESS CONTROL GUARDS
  // =========================================================================

  // A. Access Denied Guard: Customer enters Retailer POS, Manager, or Admin URL manually
  if (
    currentUser?.role === 'customer' &&
    (currentPath.startsWith('/retailer') || currentPath.startsWith('/manager') || currentPath.startsWith('/admin') || currentPath === '/new-bill')
  ) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] text-[#172B4D] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Access Restricted
            </span>
            <h2 className="text-lg font-bold text-[#172B4D] mt-2">Retailer POS Access Forbidden</h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Your account is signed in as a <strong>Customer</strong>. Customers cannot access the retailer POS billing system, barcode scanner, or financial settings.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <button
              onClick={() => navigateTo('/customer/dashboard')}
              className="w-full sm:w-auto px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Return to Customer Vault
            </button>
            <button
              onClick={handleCustomerLogout}
              className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Customer Log Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // B. Access Denied Guard: Retailer enters Manager Dashboard or Admin
  if (
    currentUser?.role === 'retailer' &&
    (currentPath.startsWith('/manager') || currentPath.startsWith('/admin'))
  ) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] text-[#172B4D] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-amber-200 rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#172B4D]">Manager Access Required</h2>
            <p className="text-xs text-slate-600 mt-1">
              This section requires Store Manager permissions.
            </p>
          </div>
          <button
            onClick={() => navigateTo('/retailer/pos')}
            className="px-4 py-2 bg-[#16A34A] text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            Return to Cashier POS
          </button>
        </div>
      </div>
    );
  }

  // C. Access Denied Guard: Manager enters Admin console
  if (
    currentUser?.role === 'manager' &&
    currentPath.startsWith('/admin')
  ) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] text-[#172B4D] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-purple-200 rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#172B4D]">System Admin Access Required</h2>
            <p className="text-xs text-slate-600 mt-1">
              This section requires System Administrator permissions.
            </p>
          </div>
          <button
            onClick={() => navigateTo('/manager/dashboard')}
            className="px-4 py-2 bg-[#172033] text-white text-xs font-bold rounded-lg cursor-pointer"
          >
            Return to Manager Dashboard
          </button>
        </div>
      </div>
    );
  }

  // C. Route: /customer/receipt-expired -> Dedicated Expired Link Screen
  if (currentPath === '/customer/receipt-expired') {
    return (
      <div className="min-h-screen bg-[#F7F9FC] text-[#172B4D] flex flex-col justify-between">
        <header className="bg-white border-b border-[#E2E8F0] px-6 py-3.5 shadow-2xs">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#16A34A] text-white flex items-center justify-center font-bold">
                C
              </div>
              <span className="font-extrabold text-[#172B4D] text-sm">ClearBill AI</span>
            </div>
            <button
              onClick={() => {
                setAuthModalRole('customer');
                setIsRegisterMode(false);
                setAuthModalOpen(true);
              }}
              className="text-xs font-semibold text-[#16A34A] px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
            >
              Customer Sign In
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 flex items-center justify-center">
          <div className="max-w-md w-full bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#172B4D]">Receipt Link Expired</h3>
              <p className="text-xs text-slate-700 mt-2 font-medium leading-relaxed">
                This receipt link has expired. Please log in to your customer account to view a receipt saved to your account.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <button
                onClick={() => {
                  setAuthModalRole('customer');
                  setIsRegisterMode(false);
                  setAuthModalOpen(true);
                }}
                className="w-full sm:w-auto px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Customer Login
              </button>
              <button
                onClick={() => navigateTo(currentUser?.role === 'customer' ? '/customer/dashboard' : '/')}
                className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Return to Customer Home
              </button>
            </div>
          </div>
        </main>

        <footer className="py-4 text-center text-[11px] text-slate-400">
          ClearBill AI Verified Digital Receipt Protection
        </footer>

        {authModalOpen && (
          <AuthModal
            initialRole={authModalRole}
            isRegistering={isRegisterMode}
            onSuccess={handleAuthSuccess}
            onClose={() => setAuthModalOpen(false)}
          />
        )}
      </div>
    );
  }

  // D. Route: /receipt/:token or /customer/receipts/:token (Digital Receipt Viewer)
  if (currentPath.startsWith('/receipt/') || currentPath.startsWith('/customer/receipts/')) {
    const isCustomerView = currentUser?.role === 'customer' || !isCashierReceiptView;
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 shadow-xs">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#16A34A] flex items-center justify-center text-white font-bold text-base shadow-xs">
                C
              </div>
              <div>
                <span className="font-extrabold text-[#172B4D] text-sm tracking-tight">ClearBill AI</span>
                <span className="block text-[10px] text-slate-400">Verified Smart Digital Receipt</span>
              </div>
            </div>
            {!currentUser ? (
              <button
                onClick={() => {
                  setAuthModalRole('customer');
                  setIsRegisterMode(false);
                  setAuthModalOpen(true);
                }}
                className="text-xs font-semibold text-[#16A34A] hover:text-[#15803D] px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 cursor-pointer"
              >
                Customer Sign In
              </button>
            ) : currentUser.role === 'customer' ? (
              <button
                onClick={() => navigateTo('/customer/dashboard')}
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer"
              >
                My Customer Vault
              </button>
            ) : (
              <button
                onClick={() => {
                  setCurrentTab('new-bill');
                  navigateTo('/retailer/pos');
                }}
                className="text-xs font-semibold text-[#16A34A] px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 cursor-pointer"
              >
                Return to POS
              </button>
            )}
          </div>
        </header>

        <main className="p-4 sm:p-6">
          <DigitalReceiptScreen
            receiptToken={activeReceiptToken}
            isCashierView={isCashierReceiptView}
            onBackToBilling={isCashierReceiptView ? handleBackToBilling : undefined}
            onGoToCustomerHome={() => {
              if (currentUser?.role === 'customer') {
                navigateTo('/customer/dashboard');
              } else {
                navigateTo('/');
              }
            }}
            onCustomerLogin={() => {
              setAuthModalRole('customer');
              setIsRegisterMode(false);
              setAuthModalOpen(true);
            }}
            onClaimSuccess={() => {}}
            onPromptAuth={() => {
              setAuthModalRole('customer');
              setIsRegisterMode(false);
              setAuthModalOpen(true);
            }}
          />
        </main>

        {authModalOpen && (
          <AuthModal
            initialRole={authModalRole}
            isRegistering={isRegisterMode}
            onSuccess={handleAuthSuccess}
            onClose={() => setAuthModalOpen(false)}
          />
        )}
      </div>
    );
  }

  // E. Route: Unauthenticated Dedicated Logins
  if (!currentUser && (currentPath === '/customer/login' || currentPath === '/retailer/login' || currentPath === '/manager/login')) {
    const roleMap: Record<string, 'customer' | 'retailer' | 'manager'> = {
      '/customer/login': 'customer',
      '/retailer/login': 'retailer',
      '/manager/login': 'manager',
    };
    const targetRole = roleMap[currentPath] || 'customer';

    return (
      <div className="min-h-screen bg-[#F7F9FC] flex flex-col justify-between">
        <header className="bg-white border-b border-[#E2E8F0] px-6 py-3.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <button
              onClick={() => navigateTo('/')}
              className="flex items-center gap-2 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-[#16A34A] text-white flex items-center justify-center font-bold">
                C
              </div>
              <span className="font-extrabold text-[#172B4D] text-base tracking-tight">ClearBill AI</span>
            </button>
            <button
              onClick={() => navigateTo('/')}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home Interface</span>
            </button>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-4">
          <AuthModal
            initialRole={targetRole}
            isRegistering={false}
            onSuccess={handleAuthSuccess}
            onClose={() => navigateTo('/')}
          />
        </div>

        <footer className="py-4 text-center text-xs text-slate-400">
          ClearBill AI · Paperless POS & Authorized Digital Invoices
        </footer>
      </div>
    );
  }

  // F. Route: Unauthenticated protected routes -> Redirect to specific role login
  if (!currentUser && (currentPath.startsWith('/retailer') || currentPath.startsWith('/manager') || currentPath.startsWith('/customer'))) {
    const role = currentPath.startsWith('/manager')
      ? 'manager'
      : currentPath.startsWith('/customer')
      ? 'customer'
      : 'retailer';
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center p-4">
        <AuthModal
          initialRole={role}
          isRegistering={false}
          onSuccess={handleAuthSuccess}
          onClose={() => navigateTo('/')}
        />
      </div>
    );
  }

  // G. Route: Home Landing Interface (When unauthenticated and at '/', or explicit home)
  if (!currentUser || currentPath === '/' || currentPath === '/home') {
    return (
      <>
        <LandingPage
          onSelectRoleLogin={role => {
            setAuthModalRole(role);
            setIsRegisterMode(false);
            setAuthModalOpen(true);
          }}
          onOpenRegister={() => {
            setAuthModalRole('manager');
            setIsRegisterMode(true);
            setAuthModalOpen(true);
          }}
          onOpenCustomerRegister={() => {
            setAuthModalRole('customer');
            setIsRegisterMode(true);
            setAuthModalOpen(true);
          }}
          onTryScanner={() => {
            // Instant launch cashier scanner demo session
            const demoRetailer: User = {
              id: 'usr-ret-01',
              email: 'cashier@clearbill.ai',
              fullName: 'Priya Patel',
              role: 'retailer',
            };
            setCurrentUser(demoRetailer);
            setCurrentTab('barcode-scanner');
            navigateTo('/retailer/pos');
          }}
          onTryQuickBill={() => {
            // Instant launch quick bill cashier demo session
            const demoRetailer: User = {
              id: 'usr-ret-01',
              email: 'cashier@clearbill.ai',
              fullName: 'Priya Patel',
              role: 'retailer',
            };
            setCurrentUser(demoRetailer);
            setCurrentTab('quick-bill');
            navigateTo('/retailer/pos');
          }}
        />

        {authModalOpen && (
          <AuthModal
            initialRole={authModalRole}
            isRegistering={isRegisterMode}
            onSuccess={handleAuthSuccess}
            onClose={() => setAuthModalOpen(false)}
          />
        )}
      </>
    );
  }

  // =========================================================================
  // H. DEDICATED CUSTOMER INTERFACE (Clean layout, NO retailer/POS elements)
  // =========================================================================
  if (currentUser.role === 'customer') {
    return (
      <CustomerPortal
        currentUser={currentUser}
        onOpenReceipt={token => {
          setActiveReceiptToken(token);
          setIsCashierReceiptView(false);
          navigateTo(`/customer/receipts/${token}`);
        }}
        onLogout={handleCustomerLogout}
        onNavigateToLogin={() => {
          setAuthModalRole('customer');
          setIsRegisterMode(false);
          setAuthModalOpen(true);
        }}
      />
    );
  }

  // =========================================================================
  // ADMIN SYSTEM WORKSPACE (Role A: Admin)
  // =========================================================================
  if (currentUser.role === 'admin') {
    return (
      <div className="min-h-screen bg-[#F7F9FC] text-[#172B4D] flex flex-col justify-between">
        <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-40 px-6 py-3.5 shadow-2xs">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-700 text-white flex items-center justify-center font-bold text-base shadow-xs">
                A
              </div>
              <div>
                <span className="font-extrabold text-[#172B4D] text-base tracking-tight block leading-tight">
                  ClearBill AI
                </span>
                <span className="text-[10px] text-purple-700 font-semibold tracking-wide uppercase">
                  System Administration Console
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-600 hidden sm:inline">
                {currentUser.fullName} ({currentUser.email})
              </span>
              <button
                onClick={handleAdminLogout}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 md:p-8">
          <AdminDashboard currentUser={currentUser} onLogout={handleAdminLogout} />
        </main>

        <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
          ClearBill AI Administration · System Oversight & Auditing
        </footer>
      </div>
    );
  }

  // =========================================================================
  // I. RETAILER POS & STORE MANAGER WORKSPACE (Staff Only)
  // =========================================================================
  return (
    <AppLayout
      currentTab={currentTab}
      onSelectTab={tab => {
        setCurrentTab(tab);
        if (tab === 'new-bill' || tab === 'quick-bill' || tab === 'barcode-scanner') {
          navigateTo('/retailer/pos');
        } else if (tab === 'dashboard') {
          navigateTo(currentUser.role === 'manager' ? '/manager/dashboard' : '/retailer/dashboard');
        }
      }}
      currentUser={currentUser}
      currentCompany={currentCompany}
      currentOutlet={currentOutlet}
      dbStatus={dbStatus}
      onLogout={handleStaffLogout}
    >
      {/* 1. Dashboard View */}
      {currentTab === 'dashboard' && (
        currentUser.role === 'manager' ? (
          <ManagerDashboard onNavigate={setCurrentTab} />
        ) : (
          <RetailerDashboard onNavigate={setCurrentTab} />
        )
      )}

      {/* 2. New Bill & Quick Bill (Dual-Mode POS) */}
      {currentTab === 'new-bill' && (
        <BillingScreen
          quickBillOnly={false}
          cartItems={cartItems}
          setCartItems={setCartItems}
          onOpenScanner={() => setCurrentTab('barcode-scanner')}
          onCheckoutSuccess={handleCheckoutSuccess}
        />
      )}

      {currentTab === 'quick-bill' && (
        <BillingScreen
          quickBillOnly={true}
          cartItems={cartItems}
          setCartItems={setCartItems}
          onOpenScanner={() => setCurrentTab('barcode-scanner')}
          onCheckoutSuccess={handleCheckoutSuccess}
        />
      )}

      {/* 3. Real-Time Camera Barcode Scanner */}
      {currentTab === 'barcode-scanner' && (
        <BarcodeScannerScreen
          onAddToCart={handleBarcodeProductAdd}
          onNavigateToBilling={() => setCurrentTab('new-bill')}
        />
      )}

      {/* 4. Cashier Digital Receipt View after finalizing bill */}
      {currentTab === 'digital-receipts' && (
        <DigitalReceiptScreen
          receiptToken={activeReceiptToken}
          isCashierView={true}
          onBackToBilling={handleBackToBilling}
          onClaimSuccess={() => {}}
        />
      )}

      {/* 5. Product Catalogue */}
      {currentTab === 'products' && <ProductCatalogue />}

      {/* 6. Billing Fields Customizer */}
      {currentTab === 'billing-fields' && <BillingFieldsCustomizer />}

      {/* 7. Transactions Ledger */}
      {currentTab === 'transactions' && (
        <TransactionsLedger
          onOpenReceipt={tok => {
            setActiveReceiptToken(tok);
            setIsCashierReceiptView(true);
            setCurrentTab('digital-receipts');
          }}
        />
      )}

      {/* 8. Payments & Settlement Configuration */}
      {currentTab === 'payments' && <PaymentsScreen />}

      {/* 9. Reconciliation */}
      {currentTab === 'reconciliation' && <ReconciliationScreen />}

      {/* 10. Sustainability ESG Report */}
      {currentTab === 'sustainability' && <SustainabilityReport />}

      {/* 11. Sales Reports */}
      {currentTab === 'reports' && <ReportsScreen />}

      {/* 12. AI Assistant */}
      {currentTab === 'ai-assistant' && (
        <AiAssistantScreen currentUser={currentUser} currentCompany={currentCompany} />
      )}

      {/* 13. Employees Management */}
      {currentTab === 'employees' && <EmployeesScreen />}

      {/* 14. Database Status */}
      {currentTab === 'db-status' && <DatabaseStatusScreen />}
    </AppLayout>
  );
}
