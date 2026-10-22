/**
 * ClearBill AI - Core TypeScript Types
 */

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'manager' | 'retailer' | 'customer' | 'admin';
  phone?: string;
}

export interface Company {
  id: string;
  business_name: string;
  category: string;
  owner_name: string;
  email: string;
  phone?: string;
  address?: string;
  currency: string;
  timezone: string;
  tax_identification_number?: string;
}

export interface Outlet {
  id: string;
  company_id: string;
  outlet_name: string;
  outlet_code: string;
  address?: string;
  phone?: string;
}

export interface Product {
  id: string;
  company_id: string;
  outlet_id?: string;
  product_name: string;
  barcode: string;
  sku?: string;
  category: string;
  unit: string;
  unit_price: number;
  cost_price?: number;
  tax_rate: number;
  description?: string;
  is_quick_bill_item: boolean;
  quick_bill_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface BillingFieldConfig {
  id: string;
  company_id: string;
  field_key: string;
  field_label: string;
  field_type: 'text' | 'number' | 'date' | 'dropdown' | 'checkbox';
  is_visible: boolean;
  is_required: boolean;
  display_order: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
  customNotes?: string;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id?: string;
  product_name: string;
  barcode?: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  line_total: number;
}

export interface Transaction {
  id: string;
  company_id: string;
  outlet_id: string;
  user_id: string;
  transaction_number: string;
  status: 'draft' | 'completed' | 'cancelled' | 'refunded';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  grand_total: number;
  payment_method: 'cash' | 'upi' | 'card' | 'split' | 'unpaid';
  payment_status: 'pending' | 'verified' | 'failed';
  customer_name?: string;
  customer_phone?: string;
  notes?: string;
  finalized_at?: string;
  created_at: string;
  items: TransactionItem[];
}

export interface ReceiptToken {
  id: string;
  token: string;
  viewing_session_seconds: number;
  expires_at: string;
  is_claimed: boolean;
}

export interface Receipt {
  id: string;
  transaction_id: string;
  receipt_number: string;
  qr_code_data: string;
  receipt_url: string;
  paper_print_avoided: boolean;
  created_at: string;
  tokens: ReceiptToken[];
}

export interface DashboardMetrics {
  totalSales: number;
  transactionsCount: number;
  completedCount: number;
  pendingPaymentsCount: number;
  digitalReceiptsCount: number;
  paperPrintsAvoided: number;
  paperSavedGrams: number;
  carbonSavedGrams: number;
  cashTotal: number;
  upiTotal: number;
  cardTotal: number;
  recentTransactions: Transaction[];
}

export interface DbStatus {
  isConnected: boolean;
  engine: 'mysql' | 'memory_fallback';
  host: string;
  port: number;
  database: string;
  user: string;
  tablesCount: number;
  message: string;
  lastChecked: string;
}
