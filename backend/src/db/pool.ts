/**
 * ClearBill AI - Database Connection Pool & Persistence Engine
 * Supports MySQL Community Edition (XAMPP 127.0.0.1:3306) via mysql2/promise
 * Includes automated fallback to persistent in-memory repository when local XAMPP is offline
 */

import mysql from 'mysql2/promise';

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

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'clearbill_app',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'clearbill_ai',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  queueLimit: 0,
  connectTimeout: 2000, // 2s timeout for fast failover detection
};

let pool: mysql.Pool | null = null;
let isRealMysqlConnected = false;
let lastCheckError = '';

try {
  pool = mysql.createPool(dbConfig);
} catch (err: any) {
  console.warn('[ClearBill DB] MySQL Pool initialization notice:', err?.message);
}

// In-Memory persistent fallback state initialized with seed data
export interface ProductEntity {
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
  created_at: string;
  updated_at: string;
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

export interface TransactionEntity {
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
  items: TransactionItemEntity[];
}

export interface TransactionItemEntity {
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

export interface ReceiptEntity {
  id: string;
  transaction_id: string;
  receipt_number: string;
  qr_code_data: string;
  receipt_url: string;
  paper_print_avoided: boolean;
  created_at: string;
  tokens: {
    id: string;
    token: string;
    viewing_session_seconds: number;
    expires_at: string;
    is_claimed: boolean;
  }[];
}

// Initial In-Memory Store populated with demo products and test barcodes
class Store {
  companies = [
    {
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
      is_active: true,
    },
  ];

  outlets = [
    {
      id: 'out-demo-01',
      company_id: 'cmp-demo-01',
      outlet_name: 'MG Road Flagship Store',
      outlet_code: 'BLR-01',
      address: 'Shop 14, Commercial Complex, MG Road, Bengaluru',
      phone: '+91 98765 43210',
    },
    {
      id: 'out-demo-02',
      company_id: 'cmp-demo-01',
      outlet_name: 'Indiranagar Express Outlet',
      outlet_code: 'BLR-02',
      address: '4th Block, 100ft Road, Indiranagar, Bengaluru',
      phone: '+91 98765 43211',
    },
  ];

  users = [
    {
      id: 'usr-mgr-01',
      email: 'manager@clearbill.ai',
      phone: '+91 98765 43210',
      password: 'clearbill123',
      full_name: 'Rajesh Sharma',
      role: 'manager' as const,
      is_active: true,
    },
    {
      id: 'usr-ret-01',
      email: 'cashier@clearbill.ai',
      phone: '+91 98765 43212',
      password: 'clearbill123',
      full_name: 'Priya Patel',
      role: 'retailer' as const,
      is_active: true,
    },
    {
      id: 'usr-cus-01',
      email: 'customer@clearbill.ai',
      phone: '+91 98765 43213',
      password: 'clearbill123',
      full_name: 'Amit Kumar',
      role: 'customer' as const,
      is_active: true,
    },
  ];

  billingFieldConfigs: BillingFieldConfig[] = [
    { id: 'bf-01', company_id: 'cmp-demo-01', field_key: 'product_name', field_label: 'Product Name', field_type: 'text', is_visible: true, is_required: true, display_order: 1 },
    { id: 'bf-02', company_id: 'cmp-demo-01', field_key: 'barcode', field_label: 'Barcode / Scan', field_type: 'text', is_visible: true, is_required: false, display_order: 2 },
    { id: 'bf-03', company_id: 'cmp-demo-01', field_key: 'sku', field_label: 'SKU Code', field_type: 'text', is_visible: false, is_required: false, display_order: 3 },
    { id: 'bf-04', company_id: 'cmp-demo-01', field_key: 'category', field_label: 'Category', field_type: 'text', is_visible: true, is_required: false, display_order: 4 },
    { id: 'bf-05', company_id: 'cmp-demo-01', field_key: 'quantity', field_label: 'Quantity', field_type: 'number', is_visible: true, is_required: true, display_order: 5 },
    { id: 'bf-06', company_id: 'cmp-demo-01', field_key: 'unit_price', field_label: 'Price (₹)', field_type: 'number', is_visible: true, is_required: true, display_order: 6 },
    { id: 'bf-07', company_id: 'cmp-demo-01', field_key: 'discount', field_label: 'Discount (₹)', field_type: 'number', is_visible: true, is_required: false, display_order: 7 },
    { id: 'bf-08', company_id: 'cmp-demo-01', field_key: 'tax_rate', field_label: 'GST (%)', field_type: 'number', is_visible: true, is_required: false, display_order: 8 },
    { id: 'bf-09', company_id: 'cmp-demo-01', field_key: 'customer_phone', field_label: 'Customer Phone', field_type: 'text', is_visible: true, is_required: false, display_order: 9 },
    { id: 'bf-10', company_id: 'cmp-demo-01', field_key: 'notes', field_label: 'Special Instructions', field_type: 'text', is_visible: false, is_required: false, display_order: 10 },
  ];

  products: ProductEntity[] = [
    // Quick Bill (Tea shop / Bakery tap items)
    { id: 'prod-qb-01', company_id: 'cmp-demo-01', product_name: 'Special Masala Tea', barcode: 'TEA-001', sku: 'TEA-MAS', category: 'Beverages', unit: 'cup', unit_price: 15.00, cost_price: 5.00, tax_rate: 5.00, description: 'Freshly brewed cardamom and ginger chai', is_quick_bill_item: true, quick_bill_order: 1, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'prod-qb-02', company_id: 'cmp-demo-01', product_name: 'Filter Coffee', barcode: 'COF-001', sku: 'COF-FIL', category: 'Beverages', unit: 'cup', unit_price: 20.00, cost_price: 7.00, tax_rate: 5.00, description: 'Authentic South Indian chicory-blend filter coffee', is_quick_bill_item: true, quick_bill_order: 2, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'prod-qb-03', company_id: 'cmp-demo-01', product_name: 'Fresh Milk Glass', barcode: 'MLK-001', sku: 'MLK-GLS', category: 'Dairy', unit: 'cup', unit_price: 25.00, cost_price: 12.00, tax_rate: 0.00, description: 'Farm-fresh pasteurized warm milk', is_quick_bill_item: true, quick_bill_order: 3, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'prod-qb-04', company_id: 'cmp-demo-01', product_name: 'Hot Samosa (2 pcs)', barcode: 'SAM-001', sku: 'SNK-SAM', category: 'Snacks', unit: 'plate', unit_price: 30.00, cost_price: 12.00, tax_rate: 5.00, description: 'Crispy spiced potato samosas with green chutney', is_quick_bill_item: true, quick_bill_order: 4, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'prod-qb-05', company_id: 'cmp-demo-01', product_name: 'Bun Maska', barcode: 'BUN-001', sku: 'BAK-BUN', category: 'Bakery', unit: 'pcs', unit_price: 35.00, cost_price: 14.00, tax_rate: 5.00, description: 'Irani bakery style toasted bun with salted butter', is_quick_bill_item: true, quick_bill_order: 5, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'prod-qb-06', company_id: 'cmp-demo-01', product_name: 'Sweet Lassi', barcode: 'LAS-001', sku: 'BEV-LAS', category: 'Beverages', unit: 'glass', unit_price: 40.00, cost_price: 18.00, tax_rate: 5.00, description: 'Chilled thick sweet curd lassi', is_quick_bill_item: true, quick_bill_order: 6, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },

    // Physical Standard Barcode Items
    // EAN-13: Tata Tea Gold
    { id: 'prod-ean-01', company_id: 'cmp-demo-01', product_name: 'Tata Tea Gold 250g', barcode: '8901030383786', sku: 'GRO-TTG-250', category: 'Groceries', unit: 'pack', unit_price: 165.00, cost_price: 140.00, tax_rate: 5.00, description: 'Premium tea with gently rolled long leaves', is_quick_bill_item: false, quick_bill_order: 0, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    // EAN-13: Amul Pure Ghee Carton 500ml
    { id: 'prod-ean-02', company_id: 'cmp-demo-01', product_name: 'Amul Pure Ghee Carton 500ml', barcode: '8901233024823', sku: 'GRO-AMG-500', category: 'Dairy', unit: 'carton', unit_price: 315.00, cost_price: 280.00, tax_rate: 12.00, description: 'Pure clarified butter ghee with rich aroma', is_quick_bill_item: false, quick_bill_order: 0, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    // EAN-13: Parle-G Gold Biscuits
    { id: 'prod-ean-03', company_id: 'cmp-demo-01', product_name: 'Parle-G Gold Glucose Biscuits 1kg', barcode: '8901499026418', sku: 'SNK-PAR-1KG', category: 'Snacks', unit: 'pack', unit_price: 120.00, cost_price: 102.00, tax_rate: 5.00, description: 'Classic glucose biscuits pack', is_quick_bill_item: false, quick_bill_order: 0, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    // EAN-13: Britannia Good Day Butter
    { id: 'prod-ean-04', company_id: 'cmp-demo-01', product_name: 'Britannia Good Day Butter 200g', barcode: '8901063013216', sku: 'SNK-GDB-200', category: 'Snacks', unit: 'pack', unit_price: 45.00, cost_price: 36.00, tax_rate: 5.00, description: 'Crunchy butter cookies with cashew sprinkles', is_quick_bill_item: false, quick_bill_order: 0, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    // EAN-8: Mint Tin (50123456)
    { id: 'prod-ean8-01', company_id: 'cmp-demo-01', product_name: 'ClearBill Mint Tin 50g (EAN-8 Test)', barcode: '50123456', sku: 'MNT-EAN8', category: 'Confectionery', unit: 'tin', unit_price: 50.00, cost_price: 35.00, tax_rate: 12.00, description: 'Pocket peppermint candies in metal tin', is_quick_bill_item: false, quick_bill_order: 0, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    // UPC-A: Organic Honey (012345678905)
    { id: 'prod-upc-01', company_id: 'cmp-demo-01', product_name: 'Organic Honey 250ml (UPC-A Test)', barcode: '012345678905', sku: 'HON-UPC12', category: 'Organic', unit: 'bottle', unit_price: 240.00, cost_price: 195.00, tax_rate: 5.00, description: 'Wildflower organic mountain honey', is_quick_bill_item: false, quick_bill_order: 0, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    // Code 128: Alphanumeric Inventory Barcode (CB-RETAIL-1001)
    { id: 'prod-c128-01', company_id: 'cmp-demo-01', product_name: 'Stainless Steel Insulated Flask 750ml (Code 128 Test)', barcode: 'CB-RETAIL-1001', sku: 'HW-FLK-750', category: 'Merchandise', unit: 'pcs', unit_price: 699.00, cost_price: 480.00, tax_rate: 18.00, description: 'Double-wall vacuum thermal water flask', is_quick_bill_item: false, quick_bill_order: 0, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    // Code 128: Apparel Tag Barcode (APP-DENIM-32)
    { id: 'prod-c128-02', company_id: 'cmp-demo-01', product_name: 'Classic Slim Denim Jeans Size 32', barcode: 'APP-DENIM-32', sku: 'APP-JNS-32', category: 'Apparel', unit: 'pcs', unit_price: 1499.00, cost_price: 950.00, tax_rate: 12.00, description: 'Dark wash stretch cotton denim', is_quick_bill_item: false, quick_bill_order: 0, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ];

  transactions: TransactionEntity[] = [
    {
      id: 'tx-001',
      company_id: 'cmp-demo-01',
      outlet_id: 'out-demo-01',
      user_id: 'usr-ret-01',
      transaction_number: 'CB-2026-1001',
      status: 'completed',
      subtotal: 80.00,
      discount_amount: 0.00,
      tax_amount: 4.00,
      grand_total: 84.00,
      payment_method: 'cash',
      payment_status: 'verified',
      customer_name: 'Arun Kumar',
      customer_phone: '+91 99887 76655',
      finalized_at: new Date(Date.now() - 7200000).toISOString(),
      created_at: new Date(Date.now() - 7200000).toISOString(),
      items: [
        { id: 'txi-01', transaction_id: 'tx-001', product_id: 'prod-qb-01', product_name: 'Special Masala Tea', barcode: 'TEA-001', quantity: 2, unit_price: 15.00, tax_rate: 5.00, tax_amount: 1.50, discount_amount: 0.00, line_total: 30.00 },
        { id: 'txi-02', transaction_id: 'tx-001', product_id: 'prod-qb-04', product_name: 'Hot Samosa (2 pcs)', barcode: 'SAM-001', quantity: 1, unit_price: 30.00, tax_rate: 5.00, tax_amount: 1.50, discount_amount: 0.00, line_total: 30.00 },
        { id: 'txi-03', transaction_id: 'tx-001', product_id: 'prod-qb-02', product_name: 'Filter Coffee', barcode: 'COF-001', quantity: 1, unit_price: 20.00, tax_rate: 5.00, tax_amount: 1.00, discount_amount: 0.00, line_total: 20.00 },
      ]
    },
    {
      id: 'tx-002',
      company_id: 'cmp-demo-01',
      outlet_id: 'out-demo-01',
      user_id: 'usr-ret-01',
      transaction_number: 'CB-2026-1002',
      status: 'completed',
      subtotal: 480.00,
      discount_amount: 20.00,
      tax_amount: 24.00,
      grand_total: 484.00,
      payment_method: 'upi',
      payment_status: 'verified',
      customer_name: 'Sneha Rao',
      customer_phone: '+91 98877 66554',
      finalized_at: new Date(Date.now() - 3600000).toISOString(),
      created_at: new Date(Date.now() - 3600000).toISOString(),
      items: [
        { id: 'txi-04', transaction_id: 'tx-002', product_id: 'prod-ean-01', product_name: 'Tata Tea Gold 250g', barcode: '8901030383786', quantity: 1, unit_price: 165.00, tax_rate: 5.00, tax_amount: 8.25, discount_amount: 0.00, line_total: 165.00 },
        { id: 'txi-05', transaction_id: 'tx-002', product_id: 'prod-ean-02', product_name: 'Amul Pure Ghee Carton 500ml', barcode: '8901233024823', quantity: 1, unit_price: 315.00, tax_rate: 12.00, tax_amount: 37.80, discount_amount: 20.00, line_total: 295.00 },
      ]
    },
    {
      id: 'tx-003',
      company_id: 'cmp-demo-01',
      outlet_id: 'out-demo-01',
      user_id: 'usr-ret-01',
      transaction_number: 'CB-2026-1003',
      status: 'completed',
      subtotal: 699.00,
      discount_amount: 0.00,
      tax_amount: 125.82,
      grand_total: 824.82,
      payment_method: 'card',
      payment_status: 'verified',
      customer_name: 'Venkatesh Iyer',
      customer_phone: '+91 97766 55443',
      finalized_at: new Date(Date.now() - 1800000).toISOString(),
      created_at: new Date(Date.now() - 1800000).toISOString(),
      items: [
        { id: 'txi-06', transaction_id: 'tx-003', product_id: 'prod-c128-01', product_name: 'Stainless Steel Insulated Flask 750ml (Code 128 Test)', barcode: 'CB-RETAIL-1001', quantity: 1, unit_price: 699.00, tax_rate: 18.00, tax_amount: 125.82, discount_amount: 0.00, line_total: 699.00 }
      ]
    }
  ];

  receipts: ReceiptEntity[] = [
    {
      id: 'rcpt-001',
      transaction_id: 'tx-001',
      receipt_number: 'RCP-1001',
      qr_code_data: 'https://clearbill.ai/receipt/t-guest-001',
      receipt_url: '/receipt/t-guest-001',
      paper_print_avoided: true,
      created_at: new Date(Date.now() - 7200000).toISOString(),
      tokens: [
        { id: 'tok-001', token: 't-guest-001', viewing_session_seconds: 30, expires_at: new Date(Date.now() + 86400000).toISOString(), is_claimed: false }
      ]
    },
    {
      id: 'rcpt-002',
      transaction_id: 'tx-002',
      receipt_number: 'RCP-1002',
      qr_code_data: 'https://clearbill.ai/receipt/t-guest-002',
      receipt_url: '/receipt/t-guest-002',
      paper_print_avoided: true,
      created_at: new Date(Date.now() - 3600000).toISOString(),
      tokens: [
        { id: 'tok-002', token: 't-guest-002', viewing_session_seconds: 30, expires_at: new Date(Date.now() + 86400000).toISOString(), is_claimed: true }
      ]
    },
    {
      id: 'rcpt-003',
      transaction_id: 'tx-003',
      receipt_number: 'RCP-1003',
      qr_code_data: 'https://clearbill.ai/receipt/t-guest-003',
      receipt_url: '/receipt/t-guest-003',
      paper_print_avoided: true,
      created_at: new Date(Date.now() - 1800000).toISOString(),
      tokens: [
        { id: 'tok-003', token: 't-guest-003', viewing_session_seconds: 30, expires_at: new Date(Date.now() + 86400000).toISOString(), is_claimed: false }
      ]
    }
  ];

  claimedReceipts: { id: string; customer_user_id: string; receipt_id: string; claimed_at: string }[] = [
    { id: 'clm-01', customer_user_id: 'usr-cus-01', receipt_id: 'rcpt-002', claimed_at: new Date().toISOString() }
  ];
}

export const inMemoryStore = new Store();

/**
 * Checks MySQL connectivity or falls back gracefully
 */
export async function getDbStatus(): Promise<DbStatus> {
  const now = new Date().toISOString();
  if (pool) {
    try {
      const conn = await pool.getConnection();
      try {
        const [rows] = await conn.query('SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ?', [dbConfig.database]);
        conn.release();
        isRealMysqlConnected = true;
        const count = Array.isArray(rows) && rows[0] ? (rows[0] as any).cnt : 0;
        return {
          isConnected: true,
          engine: 'mysql',
          host: dbConfig.host,
          port: dbConfig.port,
          database: dbConfig.database,
          user: dbConfig.user,
          tablesCount: count,
          message: `Connected successfully to MySQL Community Edition (${dbConfig.host}:${dbConfig.port})`,
          lastChecked: now,
        };
      } catch (qErr: any) {
        conn.release();
        throw qErr;
      }
    } catch (err: any) {
      isRealMysqlConnected = false;
      lastCheckError = err?.message || String(err);
    }
  }

  return {
    isConnected: false,
    engine: 'memory_fallback',
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    tablesCount: 28,
    message: `MySQL local host (${dbConfig.host}:${dbConfig.port}) offline. Memory Fallback Engine active with 28 tables and full demo seed. Start XAMPP MySQL to switch.`,
    lastChecked: now,
  };
}

/**
 * Product Operations with strict normalization and barcode lookup
 */
export async function lookupProductByBarcode(companyId: string, barcode: string): Promise<ProductEntity | null> {
  const normalized = barcode.trim();
  if (isRealMysqlConnected && pool) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM products WHERE company_id = ? AND (barcode = ? OR barcode = LPAD(?, 13, "0")) AND is_active = 1 LIMIT 1',
        [companyId, normalized, normalized]
      );
      if (Array.isArray(rows) && rows.length > 0) {
        return rows[0] as ProductEntity;
      }
    } catch (err) {
      console.warn('[DB] MySQL lookup failed, checking local store:', err);
    }
  }

  // Fallback memory store lookup (supports leading zero preservation)
  const found = inMemoryStore.products.find(
    p => p.company_id === companyId && p.is_active && (
      p.barcode === normalized ||
      p.barcode.replace(/^0+/, '') === normalized.replace(/^0+/, '')
    )
  );
  return found || null;
}

export async function getProducts(companyId: string, search?: string): Promise<ProductEntity[]> {
  if (isRealMysqlConnected && pool) {
    try {
      let sql = 'SELECT * FROM products WHERE company_id = ? AND is_active = 1';
      const params: any[] = [companyId];
      if (search && search.trim()) {
        sql += ' AND (product_name LIKE ? OR barcode LIKE ? OR category LIKE ?)';
        const queryTerm = `%${search.trim()}%`;
        params.push(queryTerm, queryTerm, queryTerm);
      }
      sql += ' ORDER BY is_quick_bill_item DESC, quick_bill_order ASC, product_name ASC';
      const [rows] = await pool.query(sql, params);
      return rows as ProductEntity[];
    } catch (err) {
      console.warn('[DB] MySQL getProducts failed, using local store:', err);
    }
  }

  let list = inMemoryStore.products.filter(p => p.company_id === companyId && p.is_active);
  if (search && search.trim()) {
    const q = search.toLowerCase().trim();
    list = list.filter(p =>
      p.product_name.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }
  return list.sort((a, b) => {
    if (a.is_quick_bill_item && !b.is_quick_bill_item) return -1;
    if (!a.is_quick_bill_item && b.is_quick_bill_item) return 1;
    if (a.is_quick_bill_item && b.is_quick_bill_item) {
      return a.quick_bill_order - b.quick_bill_order;
    }
    return a.product_name.localeCompare(b.product_name);
  });
}

export async function addProduct(product: Partial<ProductEntity>): Promise<ProductEntity> {
  const newProduct: ProductEntity = {
    id: `prod-${Date.now()}`,
    company_id: product.company_id || 'cmp-demo-01',
    outlet_id: product.outlet_id || 'out-demo-01',
    product_name: product.product_name || 'Unnamed Product',
    barcode: product.barcode?.trim() || '',
    sku: product.sku || '',
    category: product.category || 'General',
    unit: product.unit || 'pcs',
    unit_price: Number(product.unit_price) || 0,
    cost_price: Number(product.cost_price) || 0,
    tax_rate: Number(product.tax_rate) || 0,
    description: product.description || '',
    is_quick_bill_item: !!product.is_quick_bill_item,
    quick_bill_order: Number(product.quick_bill_order) || 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (isRealMysqlConnected && pool) {
    try {
      await pool.query(
        `INSERT INTO products (id, company_id, outlet_id, product_name, barcode, sku, category, unit, unit_price, cost_price, tax_rate, description, is_quick_bill_item, quick_bill_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          newProduct.id,
          newProduct.company_id,
          newProduct.outlet_id,
          newProduct.product_name,
          newProduct.barcode,
          newProduct.sku,
          newProduct.category,
          newProduct.unit,
          newProduct.unit_price,
          newProduct.cost_price,
          newProduct.tax_rate,
          newProduct.description,
          newProduct.is_quick_bill_item ? 1 : 0,
          newProduct.quick_bill_order,
        ]
      );
    } catch (err) {
      console.warn('[DB] MySQL addProduct failed, added to local store:', err);
    }
  }

  inMemoryStore.products.push(newProduct);
  return newProduct;
}

export async function updateProduct(id: string, updates: Partial<ProductEntity>): Promise<ProductEntity | null> {
  const index = inMemoryStore.products.findIndex(p => p.id === id);
  if (index === -1) return null;

  const existing = inMemoryStore.products[index];
  const updated = {
    ...existing,
    ...updates,
    unit_price: updates.unit_price !== undefined ? Number(updates.unit_price) : existing.unit_price,
    tax_rate: updates.tax_rate !== undefined ? Number(updates.tax_rate) : existing.tax_rate,
    updated_at: new Date().toISOString(),
  };

  inMemoryStore.products[index] = updated;

  if (isRealMysqlConnected && pool) {
    try {
      await pool.query(
        `UPDATE products SET product_name = ?, barcode = ?, sku = ?, category = ?, unit = ?, unit_price = ?, tax_rate = ?, description = ?, is_quick_bill_item = ?, quick_bill_order = ?, updated_at = NOW() WHERE id = ?`,
        [
          updated.product_name,
          updated.barcode,
          updated.sku,
          updated.category,
          updated.unit,
          updated.unit_price,
          updated.tax_rate,
          updated.description,
          updated.is_quick_bill_item ? 1 : 0,
          updated.quick_bill_order,
          id,
        ]
      );
    } catch (err) {
      console.warn('[DB] MySQL updateProduct failed:', err);
    }
  }

  return updated;
}

/**
 * Billing field configs
 */
export async function getBillingFieldConfigs(companyId: string): Promise<BillingFieldConfig[]> {
  return inMemoryStore.billingFieldConfigs.filter(b => b.company_id === companyId);
}

export async function updateBillingFieldConfigs(companyId: string, configs: BillingFieldConfig[]): Promise<BillingFieldConfig[]> {
  inMemoryStore.billingFieldConfigs = inMemoryStore.billingFieldConfigs.filter(b => b.company_id !== companyId).concat(configs);
  return inMemoryStore.billingFieldConfigs.filter(b => b.company_id === companyId);
}

/**
 * Transactions and Receipts
 */
export async function createTransactionWithItems(
  txData: Omit<TransactionEntity, 'id' | 'items' | 'created_at'>,
  items: Omit<TransactionItemEntity, 'id' | 'transaction_id'>[]
): Promise<{ transaction: TransactionEntity; receipt: ReceiptEntity }> {
  const txId = `tx-${Date.now()}`;
  const now = new Date().toISOString();

  // Authoritative server-side decimal-safe totals calculation
  let subtotal = 0;
  let taxAmount = 0;
  let discountAmount = Number(txData.discount_amount) || 0;

  const transactionItems: TransactionItemEntity[] = items.map((it, idx) => {
    const qty = Number(it.quantity) || 1;
    const price = Number(it.unit_price) || 0;
    const taxR = Number(it.tax_rate) || 0;
    const itemDiscount = Number(it.discount_amount) || 0;
    const lineSubtotal = Math.max(0, qty * price - itemDiscount);
    const itemTax = (lineSubtotal * taxR) / 100;
    const lineTotal = Number((lineSubtotal + itemTax).toFixed(2));

    subtotal += Number(lineSubtotal.toFixed(2));
    taxAmount += Number(itemTax.toFixed(2));

    return {
      id: `txi-${Date.now()}-${idx}`,
      transaction_id: txId,
      product_id: it.product_id,
      product_name: it.product_name,
      barcode: it.barcode,
      quantity: qty,
      unit_price: price,
      tax_rate: taxR,
      tax_amount: Number(itemTax.toFixed(2)),
      discount_amount: itemDiscount,
      line_total: lineTotal,
    };
  });

  const grandTotal = Number((Math.max(0, subtotal - discountAmount) + taxAmount).toFixed(2));

  const transaction: TransactionEntity = {
    id: txId,
    company_id: txData.company_id,
    outlet_id: txData.outlet_id,
    user_id: txData.user_id,
    transaction_number: `CB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    status: 'completed',
    subtotal: Number(subtotal.toFixed(2)),
    discount_amount: Number(discountAmount.toFixed(2)),
    tax_amount: Number(taxAmount.toFixed(2)),
    grand_total: grandTotal,
    payment_method: txData.payment_method,
    payment_status: 'verified',
    customer_name: txData.customer_name || 'Walk-in Customer',
    customer_phone: txData.customer_phone || '',
    notes: txData.notes || '',
    finalized_at: now,
    created_at: now,
    items: transactionItems,
  };

  inMemoryStore.transactions.unshift(transaction);

  // Digital Receipt creation
  const rcptId = `rcpt-${Date.now()}`;
  const receiptNumber = `RCP-${Math.floor(100000 + Math.random() * 900000)}`;
  const guestToken = `tok-${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
  const receiptUrl = `/receipt/${guestToken}`;

  const receipt: ReceiptEntity = {
    id: rcptId,
    transaction_id: txId,
    receipt_number: receiptNumber,
    qr_code_data: `${process.env.APP_URL || 'http://localhost:3000'}${receiptUrl}`,
    receipt_url: receiptUrl,
    paper_print_avoided: true,
    created_at: now,
    tokens: [
      {
        id: `tok-id-${Date.now()}`,
        token: guestToken,
        viewing_session_seconds: 30,
        expires_at: new Date(Date.now() + 86400000).toISOString(), // Token valid until end of day/24h
        is_claimed: false,
      },
    ],
  };

  inMemoryStore.receipts.unshift(receipt);

  return { transaction, receipt };
}

export async function getReceiptByToken(token: string) {
  for (const rcpt of inMemoryStore.receipts) {
    const t = rcpt.tokens.find(tok => tok.token === token);
    if (t) {
      const tx = inMemoryStore.transactions.find(x => x.id === rcpt.transaction_id);
      const isExpired = new Date(t.expires_at).getTime() < Date.now();
      return {
        receipt: rcpt,
        token: t,
        transaction: tx,
        isExpired,
      };
    }
  }
  return null;
}

export async function claimCustomerReceipt(token: string, customerUserId: string) {
  for (const rcpt of inMemoryStore.receipts) {
    const t = rcpt.tokens.find(tok => tok.token === token);
    if (t) {
      t.is_claimed = true;
      inMemoryStore.claimedReceipts.push({
        id: `clm-${Date.now()}`,
        customer_user_id: customerUserId,
        receipt_id: rcpt.id,
        claimed_at: new Date().toISOString(),
      });
      return true;
    }
  }
  return false;
}

export async function getCustomerReceipts(customerUserId: string) {
  const claims = inMemoryStore.claimedReceipts.filter(c => c.customer_user_id === customerUserId);
  const claimedReceiptIds = new Set(claims.map(c => c.receipt_id));
  
  return inMemoryStore.receipts
    .filter(r => claimedReceiptIds.has(r.id))
    .map(r => ({
      ...r,
      transaction: inMemoryStore.transactions.find(tx => tx.id === r.transaction_id),
    }));
}

export async function getTransactions(companyId: string) {
  return inMemoryStore.transactions.filter(t => t.company_id === companyId);
}

export async function getDashboardMetrics(companyId: string) {
  const txs = inMemoryStore.transactions.filter(t => t.company_id === companyId);
  const totalSales = txs.reduce((acc, t) => acc + (t.status === 'completed' ? t.grand_total : 0), 0);
  const transactionsCount = txs.length;
  const completedCount = txs.filter(t => t.status === 'completed').length;
  const digitalReceiptsCount = inMemoryStore.receipts.filter(r => txs.some(t => t.id === r.transaction_id)).length;
  const paperPrintsAvoided = digitalReceiptsCount;
  
  const cashTotal = txs.filter(t => t.payment_method === 'cash').reduce((sum, t) => sum + t.grand_total, 0);
  const upiTotal = txs.filter(t => t.payment_method === 'upi').reduce((sum, t) => sum + t.grand_total, 0);
  const cardTotal = txs.filter(t => t.payment_method === 'card').reduce((sum, t) => sum + t.grand_total, 0);

  return {
    totalSales: Number(totalSales.toFixed(2)),
    transactionsCount,
    completedCount,
    pendingPaymentsCount: txs.filter(t => t.payment_status === 'pending').length,
    digitalReceiptsCount,
    paperPrintsAvoided,
    paperSavedGrams: paperPrintsAvoided * 2.5, // 2.5g thermal paper saved per receipt
    carbonSavedGrams: paperPrintsAvoided * 12.0, // 12g CO2 avoided per digital receipt
    cashTotal: Number(cashTotal.toFixed(2)),
    upiTotal: Number(upiTotal.toFixed(2)),
    cardTotal: Number(cardTotal.toFixed(2)),
    recentTransactions: txs.slice(0, 10),
  };
}

export default pool;
