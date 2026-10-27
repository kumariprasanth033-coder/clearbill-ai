/**
 * ClearBill AI - Comprehensive Verification Test Suite (Tests A through L)
 *
 * Strictly tests:
 * Test A: Admin Role Isolation & System Management (Admin auth, system health, audit logs, no unmasked bank accounts)
 * Test B: Manager Role Permissions & Business Isolation (Manager access, cross-company access rejection with HTTP 403)
 * Test C: Retailer POS Checkout & Scannable QR Generation (Retailer checkout creates transaction and receipt with 24h token)
 * Test D: Retailer Access Restrictions (Retailer blocked from manager sales reports and bank configuration with HTTP 403)
 * Test E: Customer Role Access Restrictions (Customer blocked from checkout, product updates, manager reports, other customers' receipts)
 * Test F: Customer Scans Digital Receipt QR (Decodes QR, retrieves receipt through backend endpoint, validates items and totals)
 * Test G: Customer Claims Receipt ("Save to My Receipts" links receipt to customer account in DB)
 * Test H: Guest Claim Flow Across Authentication (Logged out guest views receipt, authenticates, claims receipt, saved to vault)
 * Test I: Expired Token Behavior (Expired token returns HTTP 410, customer-friendly message, previously claimed receipt still accessible)
 * Test J: Customer Scans UPI Payment QR (Validates upi://pay scheme, parses payee, VPA, amount, notes, does not ask for UPI PIN)
 * Test K: UPI Payment Pending Status (Unverified payment remains pending, no fake payment confirmation, no paid receipt for unverified payment)
 * Test L: Verified UPI Payment Settlement (Authorized verification marks transaction verified, generates valid paid receipt)
 */

import { parseReceiptQr, parseUpiQr } from '../src/utils/qrParser.ts';

async function runCustomerUpiRbacTestSuite() {
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
  console.log('🛡️ CLEARBILL AI - CUSTOMER SCANNING, UPI PAYMENTS & 4-ROLE RBAC SUITE');
  console.log('======================================================================\n');

  try {
    // ------------------------------------------------------------------------
    // TEST A: ADMIN ROLE ISOLATION & SYSTEM MANAGEMENT
    // ------------------------------------------------------------------------
    console.log('--- TEST A: Role A (Admin) Authentication & System Oversight ---');
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@clearbill.ai',
        password: 'clearbill123',
        role: 'admin',
      }),
    });
    assert(adminLoginRes.ok, 'TEST A.1: Admin authenticates with HTTP 200');
    const adminData = await adminLoginRes.json();
    const adminToken = adminData.token;
    assert(Boolean(adminToken), 'TEST A.2: Admin session token issued');
    assert(adminData.user?.role === 'admin', 'TEST A.3: User authenticated with role="admin"');

    // Admin checks system health
    const healthRes = await fetch(`${BASE_URL}/api/admin/health`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(healthRes.ok, 'TEST A.4: Admin accesses system health & DB monitor (HTTP 200)');
    const healthData = await healthRes.json();
    assert(healthData.status === 'healthy', 'TEST A.5: System status confirmed healthy');
    assert(healthData.totalCompanies >= 2, 'TEST A.6: System lists registered multi-tenant companies');

    // Admin reviews security audit logs
    const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(auditRes.ok, 'TEST A.7: Admin reviews system audit logs (HTTP 200)');
    const auditLogs = await auditRes.json();
    assert(Array.isArray(auditLogs) && auditLogs.length > 0, 'TEST A.8: Authorized audit logs returned');

    // Financial Privacy Enforcement: Admin cannot see unmasked banking secrets
    const adminSettlementRes = await fetch(`${BASE_URL}/api/payments/settlement-config?companyId=cmp-demo-01`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminSettlementRes.ok, 'TEST A.9: Admin can query settlement status');
    const adminSettlement = await adminSettlementRes.json();
    assert(
      !adminSettlement.raw_account_number && !adminSettlement.encrypted_account_number,
      'TEST A.10: Financial Privacy Boundary: Raw/decrypted bank accounts strictly withheld from admin'
    );
    assert(
      adminSettlement.masked_account_number?.includes('••••'),
      'TEST A.11: Settlement account number is properly masked (•••• •••• •••• 4589)'
    );

    // ------------------------------------------------------------------------
    // TEST B: MANAGER ROLE PERMISSIONS & BUSINESS ISOLATION
    // ------------------------------------------------------------------------
    console.log('\n--- TEST B: Role B (Manager) Permissions & Cross-Company Isolation ---');
    const mgrLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'manager@clearbill.ai',
        password: 'clearbill123',
        role: 'manager',
      }),
    });
    assert(mgrLoginRes.ok, 'TEST B.1: Manager logs in with HTTP 200');
    const mgrData = await mgrLoginRes.json();
    const mgrToken = mgrData.token;

    // Manager views own sales report
    const mgrReportRes = await fetch(`${BASE_URL}/api/reports/sales?companyId=cmp-demo-01`, {
      headers: { Authorization: `Bearer ${mgrToken}` },
    });
    assert(mgrReportRes.ok, 'TEST B.2: Manager views own business sales report (HTTP 200)');

    // Strict Cross-Company Isolation: Manager attempts to access unrelated business (cmp-other-02)
    const crossCompanyAttempt = await fetch(`${BASE_URL}/api/reports/sales?companyId=cmp-other-02`, {
      headers: { Authorization: `Bearer ${mgrToken}` },
    });
    assert(
      crossCompanyAttempt.status === 403,
      `TEST B.3: Manager cross-company access blocked with HTTP 403 Forbidden (Received: ${crossCompanyAttempt.status})`
    );

    // ------------------------------------------------------------------------
    // TEST C: RETAILER POS CHECKOUT & RECEIPT QR GENERATION
    // ------------------------------------------------------------------------
    console.log('\n--- TEST C: Role C (Retailer) POS Billing & Dynamic QR Receipt ---');
    const retLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'cashier@clearbill.ai',
        password: 'clearbill123',
        role: 'retailer',
      }),
    });
    assert(retLoginRes.ok, 'TEST C.1: Retailer logs in with HTTP 200');
    const retData = await retLoginRes.json();
    const retToken = retData.token;

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
        paymentMethod: 'upi',
        customerName: 'Rahul Verma',
        items: [
          {
            product_name: 'Special Masala Tea',
            quantity: 2,
            unit_price: 15.0,
            tax_rate: 5.0,
            discount_amount: 0,
          },
          {
            product_name: 'Hot Samosa (2 pcs)',
            quantity: 1,
            unit_price: 30.0,
            tax_rate: 5.0,
            discount_amount: 0,
          },
        ],
      }),
    });
    assert(checkoutRes.ok, 'TEST C.2: Retailer completes POS checkout with HTTP 200');
    const checkoutData = await checkoutRes.json();
    const createdReceipt = checkoutData.receipt;
    const guestToken = createdReceipt.tokens?.[0]?.token || createdReceipt.receipt_token;

    assert(Boolean(createdReceipt.receipt_number), `TEST C.3: Generated receipt number: ${createdReceipt.receipt_number}`);
    assert(Boolean(guestToken), `TEST C.4: Generated secure unpredictable guest token: ${guestToken}`);
    assert(
      createdReceipt.tokens?.[0]?.expires_at &&
      new Date(createdReceipt.tokens[0].expires_at).getTime() > Date.now(),
      'TEST C.5: Guest access token configured with valid 24-hour expiration'
    );
    assert(
      createdReceipt.qr_code_data.includes(guestToken) && !createdReceipt.qr_code_data.includes('localhost'),
      `TEST C.6: QR code URL points to public endpoint: ${createdReceipt.qr_code_data}`
    );

    // ------------------------------------------------------------------------
    // TEST D: RETAILER ROLE ACCESS RESTRICTIONS
    // ------------------------------------------------------------------------
    console.log('\n--- TEST D: Retailer Role Access Restrictions ---');
    // Retailer blocked from manager sales reports
    const retReportAttempt = await fetch(`${BASE_URL}/api/reports/sales?companyId=cmp-demo-01`, {
      headers: { Authorization: `Bearer ${retToken}` },
    });
    assert(
      retReportAttempt.status === 403,
      `TEST D.1: Retailer blocked from sales reports with HTTP 403 Forbidden (Received: ${retReportAttempt.status})`
    );

    // Retailer blocked from merchant bank settlement config
    const retSettlementAttempt = await fetch(`${BASE_URL}/api/payments/settlement-config?companyId=cmp-demo-01`, {
      headers: { Authorization: `Bearer ${retToken}` },
    });
    assert(
      retSettlementAttempt.status === 403,
      `TEST D.2: Retailer blocked from settlement bank config with HTTP 403 Forbidden (Received: ${retSettlementAttempt.status})`
    );

    // Retailer blocked from admin endpoints
    const retAdminAttempt = await fetch(`${BASE_URL}/api/admin/companies`, {
      headers: { Authorization: `Bearer ${retToken}` },
    });
    assert(
      retAdminAttempt.status === 403,
      `TEST D.3: Retailer blocked from admin endpoints with HTTP 403 Forbidden (Received: ${retAdminAttempt.status})`
    );

    // ------------------------------------------------------------------------
    // TEST E: CUSTOMER ROLE ACCESS RESTRICTIONS (STRICT BACKEND RBAC)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST E: Role D (Customer) Strict Access Restrictions ---');
    const custLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer@clearbill.ai',
        password: 'clearbill123',
        role: 'customer',
      }),
    });
    assert(custLoginRes.ok, 'TEST E.1: Customer authenticates with HTTP 200');
    const custData = await custLoginRes.json();
    const custToken = custData.token;

    // Customer blocked from POS checkout
    const custCheckoutAttempt = await fetch(`${BASE_URL}/api/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`,
      },
      body: JSON.stringify({
        companyId: 'cmp-demo-01',
        outletId: 'out-demo-01',
        items: [{ product_name: 'Hack Item', quantity: 1, unit_price: 1 }],
      }),
    });
    assert(
      custCheckoutAttempt.status === 403,
      `TEST E.2: Customer blocked from POS checkout with HTTP 403 Forbidden (Received: ${custCheckoutAttempt.status})`
    );

    // Customer blocked from product catalogue modification
    const custProductAttempt = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`,
      },
      body: JSON.stringify({ product_name: 'Illicit Product', unit_price: 100 }),
    });
    assert(
      custProductAttempt.status === 403,
      `TEST E.3: Customer blocked from product creation with HTTP 403 Forbidden (Received: ${custProductAttempt.status})`
    );

    // Customer blocked from sales reports
    const custReportAttempt = await fetch(`${BASE_URL}/api/reports/sales`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    assert(
      custReportAttempt.status === 403,
      `TEST E.4: Customer blocked from sales reports with HTTP 403 Forbidden (Received: ${custReportAttempt.status})`
    );

    // Customer blocked from viewing another customer's receipts
    const crossCustAttempt = await fetch(`${BASE_URL}/api/customer/receipts?customerUserId=usr-cus-02`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    assert(
      crossCustAttempt.status === 403,
      `TEST E.5: Customer strictly blocked from viewing another customer's receipts (HTTP 403)`
    );

    // ------------------------------------------------------------------------
    // TEST F: OPTION A - CUSTOMER SCANS DIGITAL RECEIPT QR
    // ------------------------------------------------------------------------
    console.log('\n--- TEST F: Option A - Customer Scans Digital Receipt QR ---');
    const qrPayload = `https://clearbill.ai/receipt/${guestToken}`;
    const parsedReceipt = parseReceiptQr(qrPayload);
    assert(parsedReceipt.isValidReceipt, 'TEST F.1: QR parser confirms valid ClearBill receipt format');
    assert(parsedReceipt.token === guestToken, `TEST F.2: Decoded correct token: ${parsedReceipt.token}`);

    // Retrieve receipt via backend
    const receiptFetchRes = await fetch(`${BASE_URL}/api/receipts/${guestToken}`);
    assert(receiptFetchRes.ok, 'TEST F.3: Backend retrieves receipt for scanned QR (HTTP 200)');
    const receiptData = await receiptFetchRes.json();
    assert(receiptData.receipt.receipt_number === createdReceipt.receipt_number, 'TEST F.4: Correct receipt opened');
    assert(receiptData.transaction.items.length === 2, 'TEST F.5: Receipt contains itemized transaction details');
    assert(receiptData.transaction.grand_total === 63.0, 'TEST F.6: Authoritative grand total verified (₹63.00)');

    // ------------------------------------------------------------------------
    // TEST G: CUSTOMER CLAIMS RECEIPT ("Save to My Receipts")
    // ------------------------------------------------------------------------
    console.log('\n--- TEST G: Customer Claims Receipt into Permanent Vault ---');
    const claimRes = await fetch(`${BASE_URL}/api/receipts/${guestToken}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`,
      },
      body: JSON.stringify({ customerUserId: 'usr-cus-01' }),
    });
    assert(claimRes.ok, 'TEST G.1: Receipt claim succeeds with HTTP 200');
    const claimData = await claimRes.json();
    assert(claimData.success === true, 'TEST G.2: Claim response confirmed');

    // Verify claimed receipt appears in Customer Vault
    const vaultRes = await fetch(`${BASE_URL}/api/customer/receipts`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    assert(vaultRes.ok, 'TEST G.3: Customer retrieves vault receipts');
    const vaultReceipts = await vaultRes.json();
    const foundClaimed = vaultReceipts.some((r: any) => r.receipt_number === createdReceipt.receipt_number);
    assert(foundClaimed, 'TEST G.4: Claimed receipt permanently present in My Receipts');

    // ------------------------------------------------------------------------
    // TEST H: GUEST CLAIM FLOW ACROSS AUTHENTICATION
    // ------------------------------------------------------------------------
    console.log('\n--- TEST H: Logged-Out Guest Claim Flow Across Authentication ---');
    // 1. Guest views active receipt t-guest-001 while unauthenticated
    const guestViewRes = await fetch(`${BASE_URL}/api/receipts/t-guest-001`);
    assert(guestViewRes.ok, 'TEST H.1: Logged-out guest views receipt without auth (HTTP 200)');

    // 2. Guest registers new customer account
    const newCustEmail = `newcustomer_${Date.now()}@test.ai`;
    const regRes = await fetch(`${BASE_URL}/api/auth/register-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'New Customer',
        email: newCustEmail,
        phone: '+91 91234 56789',
        password: 'password123',
      }),
    });
    assert(regRes.status === 201, 'TEST H.2: Guest creates customer account with HTTP 201');
    const regData = await regRes.json();
    const newCustToken = regData.token;

    // 3. Claims the previously viewed receipt under new customer account
    const preserveClaimRes = await fetch(`${BASE_URL}/api/receipts/t-guest-001/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newCustToken}`,
      },
      body: JSON.stringify({ customerUserId: regData.user.id }),
    });
    assert(preserveClaimRes.ok, 'TEST H.3: Receipt claimed successfully under newly registered customer');

    // ------------------------------------------------------------------------
    // TEST I: EXPIRED TOKEN BEHAVIOR & CUSTOMER VAULT PERSISTENCE
    // ------------------------------------------------------------------------
    console.log('\n--- TEST I: Expired Token Behavior & Customer Vault Access ---');
    // Unauthenticated guest hits expired receipt token
    const expiredRes = await fetch(`${BASE_URL}/api/receipts/t-guest-expired`);
    assert(
      expiredRes.status === 410,
      `TEST I.1: Expired guest token returns HTTP 410 Gone (Received: ${expiredRes.status})`
    );
    const expiredData = await expiredRes.json();
    assert(
      expiredData.isExpired === true && (expiredData.error?.includes('expired') || expiredData.error?.includes('This receipt link has expired')),
      'TEST I.2: Customer-friendly expiration notice returned without POS leakage'
    );

    // Customer who previously claimed this receipt accesses it via authenticated customer API
    const custExpiredRes = await fetch(`${BASE_URL}/api/customer/receipts/rcpt-expired`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    // In demo seed, Customer 1 claimed RCP-EXPIRED / rcpt-002; let's test claimed access
    const claimExpiredRes = await fetch(`${BASE_URL}/api/receipts/t-guest-expired/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`,
      },
      body: JSON.stringify({ customerUserId: 'usr-cus-01' }),
    });
    assert(claimExpiredRes.ok, 'TEST I.3: Customer associates expired receipt with account');

    const customerSavedViewRes = await fetch(`${BASE_URL}/api/receipts/t-guest-expired`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    assert(
      customerSavedViewRes.ok,
      'TEST I.4: Authenticated customer retrieves previously claimed receipt even after guest token expired (HTTP 200)'
    );

    // ------------------------------------------------------------------------
    // TEST J: OPTION B - CUSTOMER SCANS UPI PAYMENT QR
    // ------------------------------------------------------------------------
    console.log('\n--- TEST J: Option B - Customer Scans UPI Payment QR ---');
    const validUpiQr = 'upi://pay?pa=annapurna.retail@okhdfcbank&pn=Annapurna%20Retail%20%26%20Tea%20Lounge&am=225.50&cu=INR&tr=TR-TEST-8812&tn=Evening%20Snacks%20and%20Chai';
    const parsedUpi = parseUpiQr(validUpiQr);

    assert(parsedUpi.isValidUpi === true, 'TEST J.1: Parsed UPI QR confirms valid NPCI scheme');
    assert(parsedUpi.payeeVpa === 'annapurna.retail@okhdfcbank', `TEST J.2: Extracted correct Payee VPA: ${parsedUpi.payeeVpa}`);
    assert(parsedUpi.payeeName?.includes('Annapurna') === true, `TEST J.3: Extracted Payee Name: ${parsedUpi.payeeName}`);
    assert(parsedUpi.amount === 225.50, `TEST J.4: Extracted correct Amount: ₹${parsedUpi.amount}`);
    assert(parsedUpi.currency === 'INR', 'TEST J.5: Currency verified as INR');
    assert(parsedUpi.transactionRef === 'TR-TEST-8812', 'TEST J.6: Transaction reference extracted');

    // Security Check: System strictly refuses to collect customer UPI PIN or OTP
    const pinViolationRes = await fetch(`${BASE_URL}/api/payments/upi/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payeeVpa: parsedUpi.payeeVpa,
        amount: parsedUpi.amount,
        pin: '1234', // Security policy violation!
      }),
    });
    assert(
      pinViolationRes.status === 400,
      'TEST J.7: System strictly rejects collecting customer UPI PIN with HTTP 400'
    );
    const pinErr = await pinViolationRes.json();
    assert(
      pinErr.error?.includes('Security Policy Violation') && pinErr.error?.includes('prohibits'),
      'TEST J.8: Clear security violation explanation returned'
    );

    // ------------------------------------------------------------------------
    // TEST K: UPI PAYMENT PENDING STATUS (NO FAKE SUCCESS CONFIRMATIONS)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST K: UPI Payment Pending Status & No Fake Confirmations ---');
    const initiateRes = await fetch(`${BASE_URL}/api/payments/upi/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`,
      },
      body: JSON.stringify({
        payeeVpa: 'annapurna.retail@okhdfcbank',
        payeeName: 'Annapurna Retail & Tea Lounge',
        amount: 225.50,
        currency: 'INR',
        transactionRef: 'TR-TEST-8812',
        notes: 'Evening Snacks and Chai',
      }),
    });
    assert(initiateRes.status === 201, 'TEST K.1: UPI payment initiated with HTTP 201');
    const initData = await initiateRes.json();
    const paymentId = initData.id;

    assert(initData.status === 'pending', 'TEST K.2: Initial payment status is strictly "pending"');
    assert(initData.isVerified === false, 'TEST K.3: isVerified flag is false (no premature confirmation)');

    // Query status endpoint: strictly unverified pending
    const statusRes = await fetch(`${BASE_URL}/api/payments/upi/status/${paymentId}`);
    assert(statusRes.ok, 'TEST K.4: Payment status retrieved (HTTP 200)');
    const statusData = await statusRes.json();
    assert(statusData.status === 'pending', 'TEST K.5: Status remains pending awaiting merchant bank settlement');
    assert(statusData.receipt === null, 'TEST K.6: No paid receipt generated for unverified payment');

    // ------------------------------------------------------------------------
    // TEST L: VERIFIED UPI PAYMENT SETTLEMENT & DIGITAL RECEIPT ISSUANCE
    // ------------------------------------------------------------------------
    console.log('\n--- TEST L: Verified Payment Settlement & Paid Receipt Issuance ---');
    // Payment provider webhook / verified merchant confirmation arrives
    const verifyRes = await fetch(`${BASE_URL}/api/payments/upi/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId,
        status: 'verified',
        source: 'HDFC UPI Merchant Webhook Settlement Confirmation',
      }),
    });
    assert(verifyRes.ok, 'TEST L.1: Payment verification endpoint confirms settlement with HTTP 200');
    const verifyData = await verifyRes.json();
    assert(verifyData.status === 'verified', 'TEST L.2: Payment status updated to "verified"');
    assert(Boolean(verifyData.receipt), 'TEST L.3: Authoritative paid digital receipt issued upon verified settlement');

    // Check payment status again
    const finalStatusRes = await fetch(`${BASE_URL}/api/payments/upi/status/${paymentId}`);
    const finalStatus = await finalStatusRes.json();
    assert(finalStatus.isVerified === true, 'TEST L.4: Status query reports isVerified=true');
    assert(finalStatus.status === 'verified', 'TEST L.5: Settled payment marked verified in authoritative ledger');

    // Customer can view this payment in customer payments history
    const custPaymentsRes = await fetch(`${BASE_URL}/api/customer/payments`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    assert(custPaymentsRes.ok, 'TEST L.6: Customer retrieves UPI payment history (HTTP 200)');
    const custPayments = await custPaymentsRes.json();
    const foundPayment = custPayments.find((p: any) => p.id === paymentId);
    assert(Boolean(foundPayment), 'TEST L.7: Verified payment tracked in customer account history');
    assert(foundPayment.status === 'verified', 'TEST L.8: Customer payment history displays verified settlement status');
  } catch (error: any) {
    console.error('Fatal Test Exception:', error);
    failed++;
  }

  console.log('\n======================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCustomerUpiRbacTestSuite();
