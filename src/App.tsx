/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
import { AiAssistantScreen } from './pages/AiAssistantScreen.tsx';
import { DatabaseStatusScreen } from './pages/DatabaseStatusScreen.tsx';
import { TransactionsLedger } from './pages/TransactionsLedger.tsx';
import { SustainabilityReport } from './pages/SustainabilityReport.tsx';
import { ReconciliationScreen } from './pages/ReconciliationScreen.tsx';
import { PaymentsScreen } from './pages/PaymentsScreen.tsx';
import { ReportsScreen } from './pages/ReportsScreen.tsx';
import { EmployeesScreen } from './pages/EmployeesScreen.tsx';
import { User, Company, Outlet, CartItem, Product, DbStatus } from './types.ts';

export default function App() {
  // Authentication & session state (External phones scanning receipt open in guest customer mode)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/receipt/') || window.location.search.includes('receipt') || window.location.search.includes('token')) {
        return null; // Guest customer scanning receipt on mobile phone
      }
    }
    return {
      id: 'usr-ret-01',
      email: 'cashier@clearbill.ai',
      fullName: 'Priya Patel',
      role: 'retailer',
      phone: '+91 98765 43212',
    };
  });

  const [currentCompany, setCurrentCompany] = useState<Company | null>({
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
  });

  const [currentOutlet, setCurrentOutlet] = useState<Outlet | null>({
    id: 'out-demo-01',
    company_id: 'cmp-demo-01',
    outlet_name: 'MG Road Flagship Store',
    outlet_code: 'BLR-01',
    address: 'Shop 14, Commercial Complex, MG Road, Bengaluru',
    phone: '+91 98765 43210',
  });

  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);

  // App routing state
  const [currentTab, setCurrentTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/receipt/') || window.location.search.includes('receipt') || window.location.search.includes('token')) {
        return 'digital-receipts';
      }
    }
    return 'dashboard';
  });
  const [isLandingPage, setIsLandingPage] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalRole, setAuthModalRole] = useState<'manager' | 'retailer' | 'customer'>('retailer');
  const [isRegisterMode, setIsRegisterMode] = useState(false);

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

  // Active digital receipt token to view (defaults to URL path token if present)
  const [activeReceiptToken, setActiveReceiptToken] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/receipt/')) {
        const tok = path.replace('/receipt/', '').split('/')[0].split('?')[0];
        if (tok) return tok;
      }
      const params = new URLSearchParams(window.location.search);
      const qTok = params.get('receipt') || params.get('token');
      if (qTok) return qTok;
    }
    return 't-guest-001';
  });

  // URL routing effect for direct receipt link and popstate navigation
  useEffect(() => {
    const handleUrlRoute = () => {
      if (typeof window === 'undefined') return;
      const path = window.location.pathname;
      if (path.startsWith('/receipt/')) {
        const tok = path.replace('/receipt/', '').split('/')[0].split('?')[0];
        if (tok) {
          setActiveReceiptToken(tok);
          setCurrentTab('digital-receipts');
          setIsLandingPage(false);
          return;
        }
      }
      const params = new URLSearchParams(window.location.search);
      const qTok = params.get('receipt') || params.get('token');
      if (qTok) {
        setActiveReceiptToken(qTok);
        setCurrentTab('digital-receipts');
        setIsLandingPage(false);
      }
    };

    handleUrlRoute();
    window.addEventListener('popstate', handleUrlRoute);
    return () => window.removeEventListener('popstate', handleUrlRoute);
  }, []);

  // Check database status on mount
  useEffect(() => {
    fetch('/api/db/status')
      .then(r => r.json())
      .then(setDbStatus)
      .catch(console.error);
  }, []);

  // When a barcode is scanned by camera, add or increment item in bill
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

  const handleCheckoutSuccess = (receiptToken: string) => {
    setActiveReceiptToken(receiptToken);
    setCurrentTab('digital-receipts');
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `/receipt/${receiptToken}`);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLandingPage(true);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/');
    }
  };

  const handleAuthSuccess = (user: User, company: Company, outlet: Outlet) => {
    setCurrentUser(user);
    setCurrentCompany(company);
    setCurrentOutlet(outlet);
    setAuthModalOpen(false);
    setIsLandingPage(false);
    // If user logged in while viewing a receipt, remain on the receipt
    if (currentTab !== 'digital-receipts') {
      setCurrentTab('dashboard');
    }
  };

  // If viewing a digital receipt directly (e.g. customer scanned QR with phone)
  if (currentTab === 'digital-receipts' && !currentUser) {
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
          </div>
        </header>

        <main className="p-4 sm:p-6">
          <DigitalReceiptScreen
            receiptToken={activeReceiptToken}
            onBackToBilling={() => {
              if (typeof window !== 'undefined') window.history.pushState(null, '', '/');
              setIsLandingPage(true);
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

  // If user navigated to landing page or logged out
  if (isLandingPage || !currentUser) {
    return (
      <>
        <LandingPage
          onSelectRoleLogin={role => {
            setAuthModalRole(role);
            setIsRegisterMode(false);
            setAuthModalOpen(true);
          }}
          onOpenRegister={() => {
            setIsRegisterMode(true);
            setAuthModalOpen(true);
          }}
          onTryScanner={() => {
            // Instant launch cashier scanner test
            setCurrentUser({
              id: 'usr-ret-01',
              email: 'cashier@clearbill.ai',
              fullName: 'Priya Patel',
              role: 'retailer',
            });
            setIsLandingPage(false);
            setCurrentTab('barcode-scanner');
          }}
          onTryQuickBill={() => {
            // Instant launch quick bill cashier test
            setCurrentUser({
              id: 'usr-ret-01',
              email: 'cashier@clearbill.ai',
              fullName: 'Priya Patel',
              role: 'retailer',
            });
            setIsLandingPage(false);
            setCurrentTab('quick-bill');
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

  return (
    <AppLayout
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      currentUser={currentUser}
      currentCompany={currentCompany}
      currentOutlet={currentOutlet}
      dbStatus={dbStatus}
      onLogout={handleLogout}
    >
      {/* Dynamic Main Views */}
      {currentTab === 'dashboard' && (
        currentUser.role === 'manager' ? (
          <ManagerDashboard onNavigate={setCurrentTab} />
        ) : currentUser.role === 'customer' ? (
          <CustomerPortal
            onOpenReceipt={tok => {
              setActiveReceiptToken(tok);
              setCurrentTab('digital-receipts');
            }}
          />
        ) : (
          <RetailerDashboard onNavigate={setCurrentTab} />
        )
      )}

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

      {currentTab === 'barcode-scanner' && (
        <BarcodeScannerScreen
          onAddToCart={handleBarcodeProductAdd}
          onNavigateToBilling={() => setCurrentTab('new-bill')}
        />
      )}

      {currentTab === 'digital-receipts' && (
        <DigitalReceiptScreen
          receiptToken={activeReceiptToken}
          onBackToBilling={() => {
            if (typeof window !== 'undefined') window.history.pushState(null, '', '/');
            setCurrentTab('new-bill');
          }}
          onClaimSuccess={() => {}}
          onPromptAuth={() => {
            setAuthModalRole('customer');
            setIsRegisterMode(false);
            setAuthModalOpen(true);
          }}
        />
      )}

      {currentTab === 'products' && <ProductCatalogue />}

      {currentTab === 'billing-fields' && <BillingFieldsCustomizer />}

      {currentTab === 'transactions' && (
        <TransactionsLedger
          onOpenReceipt={tok => {
            setActiveReceiptToken(tok);
            setCurrentTab('digital-receipts');
          }}
        />
      )}

      {currentTab === 'payments' && <PaymentsScreen />}

      {currentTab === 'reconciliation' && <ReconciliationScreen />}

      {currentTab === 'sustainability' && <SustainabilityReport />}

      {currentTab === 'reports' && <ReportsScreen />}

      {currentTab === 'ai-assistant' && (
        <AiAssistantScreen currentUser={currentUser} currentCompany={currentCompany} />
      )}

      {currentTab === 'employees' && <EmployeesScreen />}

      {currentTab === 'db-status' && <DatabaseStatusScreen />}
    </AppLayout>
  );
}
