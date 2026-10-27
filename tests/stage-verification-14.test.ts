/**
 * ClearBill AI - 14-Stage Verification Automated Test Suite
 *
 * Verifies all 14 application stages required by the specification:
 * 1. Business owner registers -> Business dashboard becomes available
 * 2. Customer creates an account -> Customer dashboard becomes available
 * 3. Cashier completes a bill -> Transaction and receipt are saved in MySQL
 * 4. Customer opens a guest receipt -> Dynamic receipt preview and countdown appear
 * 5. Guest preview expires -> Guest access closes (HTTP 410); permanent transaction remains
 * 6. Customer saved the receipt earlier -> Receipt remains accessible through My Receipts
 * 7. Cashier selects UPI -> A genuine payment request is created (pending, no fake success)
 * 8. Customer pays -> Backend verifies the payment
 * 9. Payment is confirmed -> Corresponding digital receipt becomes available
 * 10. Strict RBAC: Customer blocked from Cashier POS (HTTP 403)
 * 11. Strict RBAC: Customer blocked from Manager Reports (HTTP 403)
 * 12. Strict RBAC: Customer blocked from Manager Bank Settlement Config (HTTP 403)
 * 13. Financial Security: Reject collection of UPI PINs, OTPs, or passwords (HTTP 400)
 * 14. Ledger Integrity: Authoritative decimal-safe calculations preserved
 */

async function run14StageVerificationTests() {
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
  console.log('🏛️  CLEARBILL AI - 14-STAGE COMPREHENSIVE VERIFICATION TEST SUITE');
  console.log('======================================================================\n');

  try {
    // ------------------------------------------------------------------------
    // STAGE 1: Business owner registers -> Business dashboard becomes available
    // ------------------------------------------------------------------------
    console.log('--- STAGE 1: Business Owner Registers ---');
    const randomSuffix = Date.now().toString().slice(-4);
    const bizEmail = `owner${randomSuffix}@freshmarket.com`;
    const regBizRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: `Fresh Market ${randomSuffix}`,
        category: 'grocery_store',
        ownerName: 'Sunita Rao',
        email: bizEmail,
        phone: '+91 98888 11111',
        password: 'password123',
        address: '100 Feet Road, Indiranagar, Bengaluru',
        country: 'India',
        state: 'Karnataka',
        currency: 'INR',
        taxType: 'GST',
        taxIdentificationNumber: '29ABCDE1234F1Z5',
        defaultTaxRate: 5,
        primaryOutletName: 'Indiranagar Flagship',
        paymentMethodsAccepted: ['cash', 'upi', 'card'],
      }),
    });
    assert(regBizRes.status === 201, 'STAGE 1.1: Business owner registers with 5-step parameters (HTTP 201)');
    const regBizData = await regBizRes.json();
    assert(Boolean(regBizData.token), 'STAGE 1.2: Business manager session token generated');
    assert(regBizData.user?.role === 'manager', 'STAGE 1.3: User registered with Role B (Business Owner / Manager)');
    const mgrToken = regBizData.token;
    const companyId = regBizData.company.id;

    // Verify Business Dashboard becomes available
    const dashRes = await fetch(`${BASE_URL}/api/dashboard/metrics?companyId=${companyId}`, {
      headers: { Authorization: `Bearer ${mgrToken}` },
    });
    assert(dashRes.ok, 'STAGE 1.4: Business dashboard metrics become available (HTTP 200)');
    const dashData = await dashRes.json();
    assert(typeof dashData.totalSales === 'number', 'STAGE 1.5: Manager dashboard metrics initialized');

    // ------------------------------------------------------------------------
    // STAGE 2: Customer creates an account -> Customer dashboard becomes available
    // ------------------------------------------------------------------------
    console.log('\n--- STAGE 2: Customer Creates an Account ---');
    const cusEmail = `customer${randomSuffix}@gmail.com`;
    const regCusRes = await fetch(`${BASE_URL}/api/auth/customer-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Rohan Mehra',
        email: cusEmail,
        phone: '+91 97777 22222',
        password: 'customerpass123',
      }),
    });
    assert(regCusRes.status === 201, 'STAGE 2.1: Customer registers account (HTTP 201)');
    const regCusData = await regCusRes.json();
    assert(Boolean(regCusData.token), 'STAGE 2.2: Customer session token generated');
    assert(regCusData.user?.role === 'customer', 'STAGE 2.3: User registered with Role D (Customer)');
    const cusToken = regCusData.token;
    const customerUserId = regCusData.user.id;

    // Verify Customer Dashboard / Vault becomes available
    const cusVaultRes = await fetch(`${BASE_URL}/api/customer/receipts`, {
      headers: { Authorization: `Bearer ${cusToken}` },
    });
    assert(cusVaultRes.ok, 'STAGE 2.4: Customer dashboard vault becomes available (HTTP 200)');
    const cusVault = await cusVaultRes.json();
    assert(Array.isArray(cusVault), 'STAGE 2.5: Customer vault returns saved receipts array');

    // ------------------------------------------------------------------------
    // STAGE 3: Cashier completes a bill -> Transaction and receipt are saved
    // ------------------------------------------------------------------------
    console.log('\n--- STAGE 3: Cashier Completes a Bill ---');
    const cashierLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'cashier@clearbill.ai',
        password: 'clearbill123',
        role: 'retailer',
      }),
    });
    const cashierLogin = await cashierLoginRes.json();
    const cashierToken = cashierLogin.token;

    const checkoutRes = await fetch(`${BASE_URL}/api/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        companyId: 'cmp-demo-01',
        outletId: 'out-demo-01',
        userId: 'usr-ret-01',
        paymentMethod: 'upi',
        customerName: 'Rohan Mehra',
        customerPhone: '+91 97777 22222',
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
    assert(checkoutRes.status === 200, 'STAGE 3.1: Cashier checkout succeeds (HTTP 200)');
    const checkoutData = await checkoutRes.json();
    assert(Boolean(checkoutData.transaction?.id), 'STAGE 3.2: Transaction record saved in MySQL');
    assert(Boolean(checkoutData.receipt?.receipt_number), 'STAGE 3.3: Digital receipt record generated');
    assert(checkoutData.transaction.grand_total === 63.0, 'STAGE 3.4: Authoritative grand total calculated (₹63.00)');
    const guestToken = checkoutData.receipt.receipt_token;
    const txId = checkoutData.transaction.id;
    const rcptId = checkoutData.receipt.id;
    assert(Boolean(guestToken), 'STAGE 3.5: Scannable guest token issued');

    // ------------------------------------------------------------------------
    // STAGE 4: Customer opens a guest receipt -> Dynamic preview and countdown appear
    // ------------------------------------------------------------------------
    console.log('\n--- STAGE 4: Customer Opens Dynamic Guest Receipt Preview ---');
    const guestRcptRes = await fetch(`${BASE_URL}/api/receipts/${guestToken}`);
    assert(guestRcptRes.ok, 'STAGE 4.1: Guest opens receipt preview without auth (HTTP 200)');
    const guestRcptData = await guestRcptRes.json();
    assert(guestRcptData.receipt.receipt_number === checkoutData.receipt.receipt_number, 'STAGE 4.2: Authoritative receipt number matches');
    assert(guestRcptData.token.viewing_session_seconds === 300, 'STAGE 4.3: Dynamic preview session window is 300 seconds (5 minutes)');
    assert(new Date(guestRcptData.token.expires_at).getTime() > Date.now(), 'STAGE 4.4: Dynamic expiry countdown timestamp is in future');
    assert(guestRcptData.isExpired === false, 'STAGE 4.5: Initial guest preview is active (not expired)');

    // ------------------------------------------------------------------------
    // STAGE 5: Guest preview expires -> Guest access closes; permanent transaction remains
    // ------------------------------------------------------------------------
    console.log('\n--- STAGE 5: Guest Preview Expires ---');
    // Test the pre-configured expired token
    const expTokenRes = await fetch(`${BASE_URL}/api/receipts/t-guest-expired`);
    assert(expTokenRes.status === 410, 'STAGE 5.1: Expired guest token returns HTTP 410 Gone (Received: 410)');
    const expTokenData = await expTokenRes.json();
    assert(expTokenData.isExpired === true, 'STAGE 5.2: Backend reports isExpired=true');
    assert(
      expTokenData.error.includes('dynamic guest receipt preview has expired'),
      'STAGE 5.3: Customer-friendly explanation returned without leaking POS credentials'
    );

    // Verify underlying transaction in MySQL remains permanently intact
    const verifyPermanentTx = await fetch(`${BASE_URL}/api/transactions?companyId=cmp-demo-01`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    const txsList = await verifyPermanentTx.json();
    const expiredTx = txsList.find((t: any) => t.id === 'tx-003');
    assert(Boolean(expiredTx), 'STAGE 5.4: Underlying MySQL transaction tx-003 is NOT deleted after token expiry');

    // ------------------------------------------------------------------------
    // STAGE 6: Customer saved receipt earlier -> Remains accessible through My Receipts
    // ------------------------------------------------------------------------
    console.log('\n--- STAGE 6: Customer Claimed Receipt Access Across Expiry ---');
    // Customer claims the newly created receipt
    const claimRes = await fetch(`${BASE_URL}/api/receipts/${guestToken}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cusToken}`,
      },
      body: JSON.stringify({ customerUserId }),
    });
    assert(claimRes.ok, 'STAGE 6.1: Customer claims receipt into personal vault (HTTP 200)');

    // Query customer vault to confirm receipt is present
    const customerVaultNow = await fetch(`${BASE_URL}/api/customer/receipts`, {
      headers: { Authorization: `Bearer ${cusToken}` },
    });
    const savedReceipts = await customerVaultNow.json();
    const hasClaimed = savedReceipts.some((r: any) => r.id === rcptId || r.receipt_number === checkoutData.receipt.receipt_number);
    assert(hasClaimed, 'STAGE 6.2: Saved receipt is permanently listed in customer My Receipts vault');

    // Authenticated customer can open receipt even when token is expired
    const cusDirectAccess = await fetch(`${BASE_URL}/api/receipts/t-guest-002`, {
      headers: { Authorization: `Bearer ${cusToken}` },
    });
    assert(cusDirectAccess.ok, 'STAGE 6.3: Authenticated customer retrieves claimed receipt (HTTP 200)');

    // ------------------------------------------------------------------------
    // STAGE 7: Cashier selects UPI -> Genuine payment request is created
    // ------------------------------------------------------------------------
    console.log('\n--- STAGE 7: Cashier Selects UPI ---');
    const upiInitiateRes = await fetch(`${BASE_URL}/api/payments/upi/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payeeVpa: 'annapurna.retail@okhdfcbank',
        payeeName: 'Annapurna Retail & Tea Lounge',
        amount: 63.0,
        currency: 'INR',
        transactionRef: `CB-${Date.now()}`,
        transactionId: txId,
      }),
    });
    assert(upiInitiateRes.status === 201, 'STAGE 7.1: UPI payment request created with HTTP 201');
    const upiData = await upiInitiateRes.json();
    assert(upiData.status === 'pending', 'STAGE 7.2: Initial payment attempt status is strictly "pending"');
    assert(upiData.isVerified === false, 'STAGE 7.3: isVerified is strictly false (no fake confirmations)');
    assert(upiData.upiPayload.startsWith('upi://pay?'), 'STAGE 7.4: Genuine NPCI UPI QR string formatted (upi://pay?...)');
    assert(upiData.amount === 63.0, 'STAGE 7.5: Genuine amount recorded');
    const paymentId = upiData.id;

    // ------------------------------------------------------------------------
    // STAGE 8: Customer pays -> Backend verifies the payment
    // ------------------------------------------------------------------------
    console.log('\n--- STAGE 8: Backend Verifies Customer Payment ---');
    const verifyRes = await fetch(`${BASE_URL}/api/payments/upi/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId,
        status: 'verified',
        source: 'Merchant Bank Webhook Settlement Gateway',
      }),
    });
    assert(verifyRes.ok, 'STAGE 8.1: Payment verification endpoint confirms settlement (HTTP 200)');
    const verifyData = await verifyRes.json();
    assert(verifyData.status === 'verified', 'STAGE 8.2: Payment status updated to "verified" in authoritative ledger');

    // ------------------------------------------------------------------------
    // STAGE 9: Payment is confirmed -> Digital receipt becomes available
    // ------------------------------------------------------------------------
    console.log('\n--- STAGE 9: Payment Confirmed & Receipt Issued ---');
    const statusQueryRes = await fetch(`${BASE_URL}/api/payments/upi/status/${paymentId}`);
    assert(statusQueryRes.ok, 'STAGE 9.1: Status query endpoint responds (HTTP 200)');
    const statusQuery = await statusQueryRes.json();
    assert(statusQuery.isVerified === true, 'STAGE 9.2: Payment status confirms isVerified=true');
    assert(statusQuery.status === 'verified', 'STAGE 9.3: Confirmed status is "verified"');

    // ------------------------------------------------------------------------
    // STAGE 10: Role Isolation - Customer blocked from Cashier POS
    // ------------------------------------------------------------------------
    console.log('\n--- STAGE 10: Strict RBAC: Customer Blocked from Cashier POS ---');
    const cusPosRes = await fetch(`${BASE_URL}/api/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cusToken}`,
      },
      body: JSON.stringify({ items: [{ product_name: 'Tea', quantity: 1, unit_price: 15 }] }),
    });
    assert(cusPosRes.status === 403, 'STAGE 10.1: Customer account blocked from POS billing (HTTP 403 Forbidden)');

    // ------------------------------------------------------------------------
    // STAGE 11: Role Isolation - Customer blocked from Manager Business Reports
    // ------------------------------------------------------------------------
    console.log('\n--- STAGE 11: Strict RBAC: Customer Blocked from Business Reports ---');
    const cusReportRes = await fetch(`${BASE_URL}/api/reports/sales?companyId=cmp-demo-01`, {
      headers: { Authorization: `Bearer ${cusToken}` },
    });
    assert(cusReportRes.status === 403, 'STAGE 11.1: Customer account blocked from business sales reports (HTTP 403 Forbidden)');

    // ------------------------------------------------------------------------
    // STAGE 12: Role Isolation - Customer blocked from Settlement Configuration
    // ------------------------------------------------------------------------
    console.log('\n--- STAGE 12: Strict RBAC: Customer Blocked from Bank Settlement Config ---');
    const cusSettlementRes = await fetch(`${BASE_URL}/api/payments/settlement-config?companyId=cmp-demo-01`, {
      headers: { Authorization: `Bearer ${cusToken}` },
    });
    assert(cusSettlementRes.status === 403, 'STAGE 12.1: Customer blocked from merchant bank settlement config (HTTP 403 Forbidden)');

    // ------------------------------------------------------------------------
    // STAGE 13: Financial Security - System Refuses to Collect UPI PINs/Passwords
    // ------------------------------------------------------------------------
    console.log('\n--- STAGE 13: Financial Security: No Storing PINs / Secrets ---');
    const sensitiveViolationRes = await fetch(`${BASE_URL}/api/payments/upi/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payeeVpa: 'store@upi',
        amount: 100,
        upiPin: '1234', // Prohibited secret!
      }),
    });
    assert(sensitiveViolationRes.status === 400, 'STAGE 13.1: System strictly rejects collecting customer UPI PIN (HTTP 400)');
    const sensitiveViolation = await sensitiveViolationRes.json();
    assert(
      sensitiveViolation.error.includes('Security Policy Violation'),
      'STAGE 13.2: Explanatory security policy violation returned'
    );

    // ------------------------------------------------------------------------
    // STAGE 14: MySQL Data Integrity & Decimal-Safe Calculations
    // ------------------------------------------------------------------------
    console.log('\n--- STAGE 14: Data Integrity & Decimal Calculations ---');
    const testDecimalCheckout = await fetch(`${BASE_URL}/api/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        companyId: 'cmp-demo-01',
        outletId: 'out-demo-01',
        userId: 'usr-ret-01',
        discountAmount: 5.50,
        paymentMethod: 'cash',
        items: [
          { product_name: 'Item A', quantity: 3, unit_price: 19.99, tax_rate: 18.0, discount_amount: 0 },
        ],
      }),
    });
    const decData = await testDecimalCheckout.json();
    // 3 * 19.99 = 59.97. Item tax 18% of 59.97 = 10.79. Bill discount = 5.50. Grand total = 59.97 - 5.50 + 10.79 = 65.26.
    assert(decData.transaction.subtotal === 59.97, 'STAGE 14.1: Subtotal calculated without floating point distortion (59.97)');
    assert(decData.transaction.discount_amount === 5.50, 'STAGE 14.2: Discount recorded precisely (5.50)');
    assert(decData.transaction.tax_amount === 10.79, 'STAGE 14.3: Tax rounded to 2 decimal places (10.79)');
    assert(decData.transaction.grand_total === 65.26, 'STAGE 14.4: Grand total mathematically accurate (65.26)');

    console.log('\n======================================================================');
    console.log(`🏁 14-STAGE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
  }
}

run14StageVerificationTests();
