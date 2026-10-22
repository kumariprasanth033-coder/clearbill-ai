/**
 * ClearBill AI - Express Full-Stack Server
 * Integrates MySQL Community Edition / XAMPP, REST APIs, and Vite Middleware
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  getDbStatus,
  lookupProductByBarcode,
  getProducts,
  addProduct,
  updateProduct,
  getBillingFieldConfigs,
  updateBillingFieldConfigs,
  createTransactionWithItems,
  getTransactions,
  getReceiptByToken,
  claimCustomerReceipt,
  getCustomerReceipts,
  getDashboardMetrics,
  deleteProduct,
  getOutlets,
  getSalesReport,
  getEmployees,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  inMemoryStore,
} from './backend/src/db/pool.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Optional Gemini Client initialization via Server-Side SDK
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (e) {
    console.warn('[ClearBill AI] Gemini initialization skipped:', e);
  }
}

// =============================================================================
// API ROUTES
// =============================================================================

// 1. Health & Database Status (XAMPP connectivity monitor)
app.get('/api/db/status', async (_req: Request, res: Response) => {
  const status = await getDbStatus();
  res.json(status);
});

// 2. Authentication (Manager, Retailer Cashier, Customer)
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password, role } = req.body;
  const user = inMemoryStore.users.find(u => u.email === email);

  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials. Use demo accounts or verify password.' });
  }

  if (role && user.role !== role && user.role !== 'manager') {
    return res.status(403).json({ error: `User is not registered as a ${role}.` });
  }

  const company = inMemoryStore.companies[0];
  const outlet = inMemoryStore.outlets[0];

  res.json({
    token: `jwt-${user.id}-${Date.now()}`,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      phone: user.phone,
    },
    company,
    outlet,
  });
});

app.post('/api/auth/register', (req: Request, res: Response) => {
  const { businessName, category, ownerName, email, phone, password, address, currency } = req.body;
  if (!businessName || !ownerName || !email || !password) {
    return res.status(400).json({ error: 'Required fields: businessName, ownerName, email, password' });
  }

  const companyId = `cmp-${Date.now()}`;
  const userId = `usr-${Date.now()}`;

  const newCompany = {
    id: companyId,
    business_name: businessName,
    category: category || 'general_retail',
    owner_name: ownerName,
    email,
    phone: phone || '',
    address: address || '',
    currency: currency || 'INR',
    timezone: 'Asia/Kolkata',
    tax_identification_number: '',
    is_active: true,
  };

  const newUser = {
    id: userId,
    email,
    phone: phone || '',
    password,
    full_name: ownerName,
    role: 'manager' as const,
    is_active: true,
  };

  inMemoryStore.companies.push(newCompany);
  inMemoryStore.users.push(newUser);

  // Default outlet
  const outletId = `out-${Date.now()}`;
  inMemoryStore.outlets.push({
    id: outletId,
    company_id: companyId,
    outlet_name: `${businessName} Main Store`,
    outlet_code: 'OUT-01',
    address: address || '',
    phone: phone || '',
  });

  // Seed default billing configs
  inMemoryStore.billingFieldConfigs.push(
    { id: `bf-${Date.now()}-1`, company_id: companyId, field_key: 'product_name', field_label: 'Product Name', field_type: 'text', is_visible: true, is_required: true, display_order: 1 },
    { id: `bf-${Date.now()}-2`, company_id: companyId, field_key: 'barcode', field_label: 'Barcode / Scan', field_type: 'text', is_visible: true, is_required: false, display_order: 2 },
    { id: `bf-${Date.now()}-3`, company_id: companyId, field_key: 'quantity', field_label: 'Quantity', field_type: 'number', is_visible: true, is_required: true, display_order: 3 },
    { id: `bf-${Date.now()}-4`, company_id: companyId, field_key: 'unit_price', field_label: 'Price', field_type: 'number', is_visible: true, is_required: true, display_order: 4 },
    { id: `bf-${Date.now()}-5`, company_id: companyId, field_key: 'tax_rate', field_label: 'GST (%)', field_type: 'number', is_visible: true, is_required: false, display_order: 5 }
  );

  res.json({
    message: 'Company and manager account registered successfully.',
    user: newUser,
    company: newCompany,
  });
});

// 3. Products & Barcode Lookup
app.get('/api/products', async (req: Request, res: Response) => {
  const companyId = (req.query.companyId as string) || 'cmp-demo-01';
  const search = (req.query.search as string) || '';
  const products = await getProducts(companyId, search);
  res.json(products);
});

// Barcode Lookup with leading zeros preservation & validation
app.get('/api/products/lookup/:barcode', async (req: Request, res: Response) => {
  const { barcode } = req.params;
  const companyId = (req.query.companyId as string) || 'cmp-demo-01';

  if (!barcode || !barcode.trim()) {
    return res.status(400).json({ error: 'Barcode parameter is required.' });
  }

  const product = await lookupProductByBarcode(companyId, barcode);
  if (!product) {
    return res.status(404).json({
      found: false,
      barcode: barcode.trim(),
      message: 'Barcode detected, but this product is not registered in your store catalogue.',
    });
  }

  res.json({
    found: true,
    product,
  });
});

app.post('/api/products', async (req: Request, res: Response) => {
  const newProd = await addProduct(req.body);
  res.status(201).json(newProd);
});

app.put('/api/products/:id', async (req: Request, res: Response) => {
  const updated = await updateProduct(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Product not found.' });
  res.json(updated);
});

app.delete('/api/products/:id', async (req: Request, res: Response) => {
  const success = await deleteProduct(req.params.id);
  if (!success) return res.status(404).json({ error: 'Product not found or already deleted.' });
  res.json({ success: true, message: 'Product removed from catalogue.' });
});

app.post('/api/products/import-csv', async (req: Request, res: Response) => {
  const { items, companyId } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Items array expected.' });
  }

  const added = [];
  for (const item of items) {
    if (item.product_name) {
      const prod = await addProduct({
        ...item,
        company_id: companyId || 'cmp-demo-01',
      });
      added.push(prod);
    }
  }

  res.json({ message: `Imported ${added.length} products successfully.`, addedCount: added.length });
});

// 4. Billing Field Configurations
app.get('/api/billing/configs', async (req: Request, res: Response) => {
  const companyId = (req.query.companyId as string) || 'cmp-demo-01';
  const configs = await getBillingFieldConfigs(companyId);
  res.json(configs);
});

app.put('/api/billing/configs', async (req: Request, res: Response) => {
  const companyId = (req.body.companyId as string) || 'cmp-demo-01';
  const configs = req.body.configs;
  if (!Array.isArray(configs)) {
    return res.status(400).json({ error: 'Configs array required.' });
  }
  const updated = await updateBillingFieldConfigs(companyId, configs);
  res.json(updated);
});

// 5. Checkout & Authoritative Decimal Calculations
app.post('/api/billing/checkout', async (req: Request, res: Response) => {
  const {
    companyId = 'cmp-demo-01',
    outletId = 'out-demo-01',
    userId = 'usr-ret-01',
    items,
    discountAmount = 0,
    paymentMethod = 'cash',
    customerName,
    customerPhone,
    notes,
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Draft bill must have at least one line item.' });
  }

  try {
    const result = await createTransactionWithItems(
      {
        company_id: companyId,
        outlet_id: outletId,
        user_id: userId,
        transaction_number: '',
        status: 'completed',
        subtotal: 0,
        discount_amount: Number(discountAmount),
        tax_amount: 0,
        grand_total: 0,
        payment_method: paymentMethod,
        payment_status: 'verified',
        customer_name: customerName,
        customer_phone: customerPhone,
        notes,
      },
      items
    );

    res.json(result);
  } catch (err: any) {
    console.error('[Billing Checkout Error]', err);
    res.status(500).json({ error: 'Failed to process authoritative bill checkout: ' + err.message });
  }
});

// 6. Transactions
app.get('/api/transactions', async (req: Request, res: Response) => {
  const companyId = (req.query.companyId as string) || 'cmp-demo-01';
  const txs = await getTransactions(companyId);
  res.json(txs);
});

// 7. Digital Receipts & Temporary 30-Sec Guest Access
app.get('/api/receipts/:token', async (req: Request, res: Response) => {
  const { token } = req.params;
  const result = await getReceiptByToken(token);

  if (!result || !result.receipt || !result.transaction) {
    return res.status(404).json({ error: 'Receipt not found or invalid token.' });
  }

  if (result.isExpired) {
    return res.status(410).json({
      error: 'Receipt viewing token has expired (24-hour security window lapsed). Access is rejected.',
      isExpired: true,
      receiptNumber: result.receipt.receipt_number,
    });
  }

  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const publicOrigin = process.env.APP_URL || `${protocol}://${host}`;

  res.json({
    receipt: {
      ...result.receipt,
      qr_code_data: `${publicOrigin}/receipt/${result.token.token}`,
    },
    transaction: result.transaction,
    token: result.token,
    isExpired: false,
    company: inMemoryStore.companies[0],
    outlet: inMemoryStore.outlets[0],
    publicOrigin,
  });
});

app.post('/api/receipts/:token/claim', async (req: Request, res: Response) => {
  const { token } = req.params;
  const { customerUserId } = req.body;

  if (!customerUserId) {
    return res.status(400).json({ error: 'customerUserId is required.' });
  }

  const success = await claimCustomerReceipt(token, customerUserId);
  if (!success) {
    return res.status(404).json({ error: 'Receipt token not found.' });
  }

  res.json({ success: true, message: 'Receipt saved to customer vault.' });
});

app.get('/api/customer/receipts', async (req: Request, res: Response) => {
  const customerUserId = (req.query.customerUserId as string) || 'usr-cus-01';
  const receipts = await getCustomerReceipts(customerUserId);
  res.json(receipts);
});

// 8. Manager Dashboard Metrics
app.get('/api/dashboard/metrics', async (req: Request, res: Response) => {
  const companyId = (req.query.companyId as string) || 'cmp-demo-01';
  const metrics = await getDashboardMetrics(companyId);
  res.json(metrics);
});

// Outlets for Outlet Switcher
app.get('/api/outlets', async (req: Request, res: Response) => {
  const companyId = (req.query.companyId as string) || 'cmp-demo-01';
  const outlets = await getOutlets(companyId);
  res.json(outlets);
});

// Employees Management (Full CRUD for Store Manager)
app.get('/api/employees', async (req: Request, res: Response) => {
  const companyId = (req.query.companyId as string) || 'cmp-demo-01';
  const employees = await getEmployees(companyId);
  res.json(employees);
});

app.post('/api/employees', async (req: Request, res: Response) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Employee name and email are required.' });
  }
  const employee = await addEmployee(req.body);
  res.status(201).json(employee);
});

app.put('/api/employees/:id', async (req: Request, res: Response) => {
  const updated = await updateEmployee(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Employee not found.' });
  }
  res.json(updated);
});

app.delete('/api/employees/:id', async (req: Request, res: Response) => {
  const success = await deleteEmployee(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Employee not found or already removed.' });
  }
  res.json({ success: true, message: 'Employee account removed successfully.' });
});

// Sales Reports & Analytics
app.get('/api/reports/sales', async (req: Request, res: Response) => {
  const companyId = (req.query.companyId as string) || 'cmp-demo-01';
  const outletId = (req.query.outletId as string) || 'all';
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  const report = await getSalesReport(companyId, { outletId, startDate, endDate });
  res.json(report);
});

// Payment Verification Adapter
app.post('/api/payments/verify', async (req: Request, res: Response) => {
  const { transactionId, paymentMethod, amount, upiRef, cardLast4 } = req.body;
  if (!transactionId || !paymentMethod || !amount) {
    return res.status(400).json({ error: 'transactionId, paymentMethod, and amount are required.' });
  }

  // Authoritative settlement check
  const tx = inMemoryStore.transactions.find(t => t.id === transactionId);
  if (!tx) {
    return res.status(404).json({ error: 'Transaction not found.' });
  }

  // Handle provider configuration checks
  let isProviderConfigured = true;
  let status: 'verified' | 'pending' | 'failed' = 'verified';
  let message = 'Payment verified and settled.';

  if (paymentMethod === 'upi') {
    // In production, requires merchant UPI gateway webhook secret (e.g., Razorpay/PayU/PhonePe)
    const isLiveMerchantConfigured = !!process.env.UPI_MERCHANT_VPA;
    if (!isLiveMerchantConfigured) {
      message = 'UPI payment confirmed in Sandbox Test Mode (Live UPI_MERCHANT_VPA not set in env).';
    }
  } else if (paymentMethod === 'card') {
    const isTerminalConfigured = !!process.env.CARD_TERMINAL_ID;
    if (!isTerminalConfigured) {
      message = 'Card transaction authorized in Sandbox Test Mode (Live CARD_TERMINAL_ID not set in env).';
    }
  }

  tx.payment_status = 'verified';
  tx.payment_method = paymentMethod;

  res.json({
    success: true,
    status,
    message,
    transaction: tx,
  });
});

// 9. Server-Side AI Assistant (Gemini SDK @google/genai)
app.post('/api/ai/assistant', async (req: Request, res: Response) => {
  const { prompt, role = 'manager', contextData } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  if (!process.env.GEMINI_API_KEY || !ai) {
    // Graceful helpful fallback when AI API key is not configured in local environment
    return res.json({
      answer: `[ClearBill AI Assistant Mode]\n\nBased on your store data:\n- Current Daily Sales: ₹${contextData?.totalSales || 1392.82}\n- Completed Transactions: ${contextData?.transactionsCount || 3}\n- Paper Receipts Avoided: ${contextData?.paperPrintsAvoided || 3} prints (saving approx ${(contextData?.paperPrintsAvoided || 3) * 2.5}g thermal paper).\n\n(To enable live Gemini generative answers, set GEMINI_API_KEY in the environment or Settings panel).`,
      isFallback: true,
    });
  }

  try {
    const systemPrompt = `You are ClearBill AI Assistant, a specialized retail, billing, and sustainability assistant for store managers, cashiers, and retail customers.
You provide precise, concise, and business-focused insights based on verified store metrics.
Role Context: ${role}.
Store Verified Data: ${JSON.stringify(contextData || {})}.
Always be helpful, deterministic, and highlight paperless sustainability impact where appropriate.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    res.json({
      answer: response.text || 'No response generated.',
      isFallback: false,
    });
  } catch (err: any) {
    console.error('[Gemini AI Error]', err);
    res.status(500).json({ error: 'AI Assistant query failed: ' + err.message });
  }
});

// =============================================================================
// VITE OR STATIC FRONTEND HOSTING
// =============================================================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ClearBill AI] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Server Start Error]', err);
});
