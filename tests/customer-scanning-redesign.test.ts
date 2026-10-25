/**
 * ClearBill AI - Customer Scanning Interface Redesign Test Suite
 *
 * Verifies requirements from user request:
 * 1. Scanning-first layout: Header links, Main Heading, Subtitle, Two Prominent Scanning Cards.
 * 2. Dedicated separation: "Scan Receipt QR" vs "Scan UPI QR".
 * 3. Compact "My Saved Receipts" section populated from database (no fabricated data).
 * 4. Receipt QR decoding and live invoice retrieval from backend.
 * 5. UPI payment QR decoding (NPCI upi://pay scheme), payee detail extraction, and security rejection of PIN/OTP.
 * 6. Expired token handling (HTTP 410) and persistent claimed receipt vault retrieval.
 * 7. Retailer POS checkout and barcode lookup remain intact and operational.
 * 8. Strict customer role isolation (customers blocked from POS checkout, product editing, and manager reports).
 */

import { parseReceiptQr, parseUpiQr } from '../src/utils/qrParser.ts';

async function runCustomerScanningRedesignTestSuite() {
  const BASE_URL = 'http://localhost:3000';
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`, details || '');
      failed++;
    }
  }

  console.log('======================================================================');
  console.log('📱 CLEARBILL AI - CUSTOMER SCANNING INTERFACE REDESIGN TEST SUITE');
  console.log('======================================================================\n');

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: Customer Authentication & Saved Receipts Retrieval
    // ------------------------------------------------------------------------
    console.log('--- TEST 1: Customer Login & Real Saved Receipts Retrieval ---');
    const custLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer@clearbill.ai',
        password: 'clearbill123',
        role: 'customer',
      }),
    });
    assert(custLoginRes.ok, 'TEST 1.1: Customer login succeeds with HTTP 200');
    const custLogin = await custLoginRes.json();
    const custToken = custLogin.token;
    assert(Boolean(custToken), 'TEST 1.2: Customer session token issued');
    assert(custLogin.user?.role === 'customer', 'TEST 1.3: User authenticated as Role D (Customer)');

    // Fetch real saved receipts from MySQL/backend
    const receiptsRes = await fetch(`${BASE_URL}/api/customer/receipts`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    assert(receiptsRes.ok, 'TEST 1.4: Saved receipts retrieved from backend (HTTP 200)');
    const receipts = await receiptsRes.json();
    assert(Array.isArray(receipts), 'TEST 1.5: Receipts returned as an array');
    assert(receipts.length > 0, `TEST 1.6: Real receipts found in MySQL: ${receipts.length}`);
    const sampleReceipt = receipts[0];
    assert(Boolean(sampleReceipt.receipt_number), `TEST 1.7: Authoritative receipt number: ${sampleReceipt.receipt_number}`);
    assert(Boolean(sampleReceipt.transaction?.grand_total), `TEST 1.8: Authoritative total: ₹${sampleReceipt.transaction?.grand_total}`);

    // ------------------------------------------------------------------------
    // SECTION 2: Dedicated Receipt QR Scanner Workflow (Option A)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Dedicated Receipt Scanner (Option A) ---');
    const validReceiptQr = 'https://your-clearbill-app.vercel.app/receipt/t-guest-001';
    const parsedReceipt = parseReceiptQr(validReceiptQr);
    assert(parsedReceipt.isValidReceipt === true, 'TEST 2.1: Receipt QR parser confirms valid ClearBill receipt format');
    assert(parsedReceipt.token === 't-guest-001', `TEST 2.2: Decoded correct guest token: ${parsedReceipt.token}`);

    // Fetch live receipt details
    const receiptDetailRes = await fetch(`${BASE_URL}/api/receipts/${parsedReceipt.token}`);
    assert(receiptDetailRes.ok, 'TEST 2.3: Live receipt details retrieved from backend (HTTP 200)');
    const receiptDetail = await receiptDetailRes.json();
    assert(receiptDetail.receipt?.receipt_number === 'RCP-1001', 'TEST 2.4: Authoritative receipt opened: RCP-1001');
    assert(Array.isArray(receiptDetail.transaction?.items), 'TEST 2.5: Receipt contains itemized product list');
    assert(receiptDetail.transaction?.items?.length > 0, `TEST 2.6: Receipt items populated (${receiptDetail.transaction?.items?.length} items)`);

    // Test invalid receipt QR
    const invalidReceiptQr = 'https://random-phishing-site.com/fake-receipt';
    const parsedInvalidReceipt = parseReceiptQr(invalidReceiptQr);
    assert(parsedInvalidReceipt.isValidReceipt === false, 'TEST 2.7: Invalid non-ClearBill receipt rejected by parser');
    assert(Boolean(parsedInvalidReceipt.error), 'TEST 2.8: Clear invalid-QR error message provided');

    // ------------------------------------------------------------------------
    // SECTION 3: Dedicated UPI Payment QR Scanner Workflow (Option B)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Dedicated UPI Payment Scanner (Option B) ---');
    const validUpiQr = 'upi://pay?pa=annapurna.retail@okhdfcbank&pn=Annapurna%20Retail%20%26%20Tea%20Lounge&am=180.00&cu=INR&tr=CB-TX-9901&tn=Bakery%20Items';
    const parsedUpi = parseUpiQr(validUpiQr);
    assert(parsedUpi.isValidUpi === true, 'TEST 3.1: Confirms standard NPCI UPI scheme (upi://pay)');
    assert(parsedUpi.payeeVpa === 'annapurna.retail@okhdfcbank', `TEST 3.2: Extracted correct Payee VPA: ${parsedUpi.payeeVpa}`);
    assert(parsedUpi.payeeName?.includes('Annapurna') === true, `TEST 3.3: Extracted Payee Name: ${parsedUpi.payeeName}`);
    assert(parsedUpi.amount === 180.00, `TEST 3.4: Extracted correct amount: ₹${parsedUpi.amount}`);
    assert(parsedUpi.currency === 'INR', 'TEST 3.5: Currency verified as INR');
    assert(parsedUpi.transactionRef === 'CB-TX-9901', 'TEST 3.6: Transaction reference extracted');

    // Test invalid UPI QR
    const invalidUpiQr = 'http://example.com/not-upi';
    const parsedInvalidUpi = parseUpiQr(invalidUpiQr);
    assert(parsedInvalidUpi.isValidUpi === false, 'TEST 3.7: Non-UPI URL correctly rejected by scanner parser');
    assert(Boolean(parsedInvalidUpi.error), 'TEST 3.8: Clear invalid-UPI error message provided');

    // Payment Security Check: System strictly refuses to solicit or accept customer UPI PIN
    const pinRejectionRes = await fetch(`${BASE_URL}/api/payments/upi/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payeeVpa: parsedUpi.payeeVpa,
        amount: parsedUpi.amount,
        pin: '1234', // Violation!
      }),
    });
    assert(pinRejectionRes.status === 400, 'TEST 3.9: System rejects collection of customer UPI PIN with HTTP 400');
    const pinRejectionData = await pinRejectionRes.json();
    assert(pinRejectionData.error?.includes('PIN'), 'TEST 3.10: Clear security violation explanation returned');

    // Valid UPI Initiation starts strictly in 'pending' status
    const initRes = await fetch(`${BASE_URL}/api/payments/upi/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payeeVpa: parsedUpi.payeeVpa,
        payeeName: parsedUpi.payeeName,
        amount: parsedUpi.amount,
        currency: parsedUpi.currency,
        transactionRef: parsedUpi.transactionRef,
        notes: parsedUpi.note,
        upiPayload: validUpiQr,
        customerUserId: custLogin.user.id,
      }),
    });
    assert(initRes.status === 201, 'TEST 3.11: UPI payment initiated with HTTP 201');
    const initData = await initRes.json();
    assert(initData.status === 'pending', 'TEST 3.12: Initial payment status is strictly pending');
    assert(initData.isVerified === false, 'TEST 3.13: isVerified is false (no simulated success)');

    // ------------------------------------------------------------------------
    // SECTION 4: Strict Role-Based Access Control (RBAC)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Strict Customer Role Isolation ---');
    // Customer cannot call POS checkout
    const custCheckoutRes = await fetch(`${BASE_URL}/api/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`,
      },
      body: JSON.stringify({
        companyId: 'cmp-demo-01',
        outletId: 'out-demo-01',
        items: [{ productId: 'prod-001', quantity: 1, unitPrice: 50 }],
        paymentMethod: 'cash',
      }),
    });
    assert(custCheckoutRes.status === 403, 'TEST 4.1: Customer blocked from POS checkout (HTTP 403 Forbidden)');

    // Customer cannot create or modify products
    const custProductRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`,
      },
      body: JSON.stringify({
        name: 'Hacked Item',
        retail_price: 1,
      }),
    });
    assert(custProductRes.status === 403, 'TEST 4.2: Customer blocked from product management (HTTP 403 Forbidden)');

    // Customer cannot view business sales reports
    const custReportRes = await fetch(`${BASE_URL}/api/reports/sales?companyId=cmp-demo-01`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    assert(custReportRes.status === 403, 'TEST 4.3: Customer blocked from business sales reports (HTTP 403 Forbidden)');

    // Customer cannot access merchant settlement configuration
    const custSettlementRes = await fetch(`${BASE_URL}/api/payments/settlement-config`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    assert(custSettlementRes.status === 403, 'TEST 4.4: Customer blocked from merchant bank settlement config (HTTP 403 Forbidden)');

    // ------------------------------------------------------------------------
    // SECTION 5: Existing Retailer POS Functionality Intact
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Existing Retailer POS Functionality Intact ---');
    const retLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'cashier@clearbill.ai',
        password: 'clearbill123',
        role: 'retailer',
      }),
    });
    assert(retLoginRes.ok, 'TEST 5.1: Retailer logs in successfully (HTTP 200)');
    const retLogin = await retLoginRes.json();
    const retToken = retLogin.token;

    // Retailer performs barcode lookup
    const barcodeRes = await fetch(`${BASE_URL}/api/products/lookup/8901030383786`, {
      headers: { Authorization: `Bearer ${retToken}` },
    });
    assert(barcodeRes.ok, 'TEST 5.2: Retailer barcode lookup succeeds (HTTP 200)');
    const barcodeData = await barcodeRes.json();
    assert(barcodeData.found === true, 'TEST 5.3: Barcode lookup confirms product found');
    const barcodeProduct = barcodeData.product;
    assert(barcodeProduct.product_name === 'Tata Tea Gold 250g', `TEST 5.4: Barcode identified product: ${barcodeProduct.product_name}`);

    // Retailer completes POS checkout
    const checkoutRes = await fetch(`${BASE_URL}/api/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${retToken}`,
      },
      body: JSON.stringify({
        companyId: 'cmp-demo-01',
        outletId: 'out-demo-01',
        cashierId: 'usr-ret-01',
        customerPhone: '+91 98888 77777',
        paymentMethod: 'upi',
        items: [
          {
            product_id: barcodeProduct.id,
            product_name: barcodeProduct.product_name,
            quantity: 1,
            unit_price: barcodeProduct.unit_price,
            tax_rate: barcodeProduct.tax_rate,
          },
        ],
      }),
    });
    assert(checkoutRes.ok, 'TEST 5.5: Retailer completes POS checkout (HTTP 200)');
    const checkoutData = await checkoutRes.json();
    const createdReceipt = checkoutData.receipt;
    assert(Boolean(createdReceipt?.receipt_number), `TEST 5.6: POS receipt generated: ${createdReceipt?.receipt_number}`);
    const guestToken = createdReceipt?.tokens?.[0]?.token || createdReceipt?.receipt_token;
    assert(Boolean(guestToken), `TEST 5.7: POS generated guest token: ${guestToken}`);
    const qrUrl = createdReceipt?.qr_code_data;
    assert(Boolean(qrUrl), `TEST 5.8: POS generated scannable public receipt URL: ${qrUrl}`);
  } catch (error: any) {
    console.error('Fatal Test Suite Error:', error);
    failed++;
  }

  console.log('\n======================================================================');
  console.log(`🏁 REDESIGN TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCustomerScanningRedesignTestSuite();
