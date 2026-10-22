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
import { EmployeesScreen } from './pages/EmployeesScreen.tsx';
import { User, Company, Outlet, CartItem, Product, DbStatus } from './types.ts';

export default function App() {
  // Authentication & session state
  const [currentUser, setCurrentUser] = useState<User | null>({
    id: 'usr-ret-01',
    email: 'cashier@clearbill.ai',
    fullName: 'Priya Patel',
    role: 'retailer',
    phone: '+91 98765 43212',
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
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
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

  // Active digital receipt token to view
  const [activeReceiptToken, setActiveReceiptToken] = useState<string>('t-guest-001');

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
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLandingPage(true);
  };

  const handleAuthSuccess = (user: User, company: Company, outlet: Outlet) => {
    setCurrentUser(user);
    setCurrentCompany(company);
    setCurrentOutlet(outlet);
    setAuthModalOpen(false);
    setIsLandingPage(false);
    setCurrentTab('dashboard');
  };

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
          onBackToBilling={() => setCurrentTab('new-bill')}
          onClaimSuccess={() => {}}
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

      {currentTab === 'payments' && <ReconciliationScreen />}

      {currentTab === 'reconciliation' && <ReconciliationScreen />}

      {currentTab === 'sustainability' && <SustainabilityReport />}

      {currentTab === 'reports' && <ManagerDashboard onNavigate={setCurrentTab} />}

      {currentTab === 'ai-assistant' && (
        <AiAssistantScreen currentUser={currentUser} currentCompany={currentCompany} />
      )}

      {currentTab === 'employees' && <EmployeesScreen />}

      {currentTab === 'db-status' && <DatabaseStatusScreen />}
    </AppLayout>
  );
}
