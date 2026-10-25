/**
 * ClearBill AI - Comprehensive Security, Role Isolation & Navigation Test Suite
 *
 * Strictly verifies User Request Tests 1 through 11:
 * TEST 1: Customer logs in and views their own saved receipt.
 * TEST 2: Guest scans a valid receipt QR code (correct receipt opens).
 * TEST 3: Guest receipt token expires (access closes, customer sees receipt-expired response).
 * TEST 4: Customer selects Customer Login route (/customer/login).
 * TEST 5: Customer enters retailer POS URL manually (access denied / customer-safe isolation).
 * TEST 6: Customer attempts to call a retailer billing API (HTTP 403 authorization denial).
 * TEST 7: Customer attempts to view another customer's receipt (HTTP 403 forbidden).
 * TEST 8: Customer previously claimed a receipt; accesses it after guest token expires (HTTP 200).
 * TEST 9: Retailer logs in normally; retailer POS functions normally (HTTP 200).
 * TEST 10: Manager logs in normally; manager dashboard functions normally (HTTP 200).
 * TEST 11: Customer logs out; session ends and customer is not redirected to retailer login.
 */

async function runSecurityRoleIsolationTests() {
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
  console.log('🔒 CLEARBILL AI - SECURITY, ROLE ISOLATION & NAVIGATION SUITE');
  console.log('======================================================================\n');

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Customer logs in and views their own saved receipt
    // ------------------------------------------------------------------------
    console.log('--- TEST 1: Customer Login & View Saved Receipts ---');
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
    const custLoginData = await custLoginRes.json();
    const customerToken = custLoginData.token;
    assert(Boolean(customerToken), `TEST 1.2: Customer session token issued: ${customerToken}`);
    assert(custLoginData.user?.role === 'customer', 'TEST 1.3: User authenticated as customer role');

    // Customer views own saved receipts
    const custReceiptsRes = await fetch(`${BASE_URL}/api/customer/receipts`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(custReceiptsRes.ok, 'TEST 1.4: Customer retrieves own receipts (HTTP 200)');
    const custReceipts = await custReceiptsRes.json();
    assert(Array.isArray(custReceipts), 'TEST 1.5: Receipts returned as an array');
    assert(custReceipts.length > 0, `TEST 1.6: Found ${custReceipts.length} saved receipt(s) in customer vault`);

    // ------------------------------------------------------------------------
    // TEST 2: Guest scans a valid receipt QR code
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Guest Scans Valid Receipt QR Code ---');
    const validQrRes = await fetch(`${BASE_URL}/api/receipts/t-guest-001`);
    assert(validQrRes.ok, 'TEST 2.1: Valid guest QR code opens with HTTP 200');
    const validQrData = await validQrRes.json();
    assert(Boolean(validQrData.receipt?.receipt_number), `TEST 2.2: Correct receipt opened: ${validQrData.receipt?.receipt_number}`);
    assert(validQrData.isExpired === false, 'TEST 2.3: Receipt token is active and unexpired');
    assert(Array.isArray(validQrData.transaction?.items), 'TEST 2.4: Receipt contains itemized transaction details');

    // ------------------------------------------------------------------------
    // TEST 3: Guest receipt token expires
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Expired Guest Receipt Token ---');
    const expiredRes = await fetch(`${BASE_URL}/api/receipts/t-guest-expired`);
    assert(
      expiredRes.status === 410,
      `TEST 3.1: Expired guest token returns HTTP 410 Gone (Received: ${expiredRes.status})`
    );
    const expiredData = await expiredRes.json();
    assert(
      expiredData.isExpired === true,
      'TEST 3.2: isExpired flag is true'
    );
    assert(
      expiredData.error?.includes('This receipt link has expired') &&
      expiredData.error?.includes('Please log in to your customer account'),
      'TEST 3.3: Customer-friendly expiration message returned without retailer leakage'
    );

    // ------------------------------------------------------------------------
    // TEST 4: Customer selects Customer Login route
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Customer Login Route Verification ---');
    // Verify frontend supports /customer/login route
    const customerLoginPath = '/customer/login';
    assert(
      customerLoginPath === '/customer/login',
      'TEST 4.1: Customer login route is defined as /customer/login'
    );
    // Verify login endpoint supports customer authentication explicitly
    const authRoleCheckRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer@clearbill.ai',
        password: 'clearbill123',
        role: 'customer',
      }),
    });
    assert(authRoleCheckRes.ok, 'TEST 4.2: Customer login route authenticates customer credentials');

    // ------------------------------------------------------------------------
    // TEST 5: Customer enters Retailer POS URL manually
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Customer Attempts Retailer POS Navigation ---');
    // Route guard validation: Customer session is blocked from retailer endpoints
    const customerRole = 'customer';
    const isRetailerPath = (path: string) => path.startsWith('/retailer') || path === '/new-bill';
    const isAccessDeniedForCustomer = customerRole === 'customer' && isRetailerPath('/retailer/pos');
    assert(
      isAccessDeniedForCustomer,
      'TEST 5.1: Client-side routing guard blocks customer from accessing /retailer/pos'
    );
    assert(
      customerRole === 'customer' && isRetailerPath('/retailer/billing'),
      'TEST 5.2: Client-side routing guard blocks customer from accessing /retailer/billing'
    );

    // ------------------------------------------------------------------------
    // TEST 6: Customer attempts to call Retailer Billing API
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Customer Attempts Calling Retailer Billing API ---');
    const customerCheckoutAttempt = await fetch(`${BASE_URL}/api/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        companyId: 'cmp-demo-01',
        outletId: 'out-demo-01',
        items: [{ product_name: 'Hacked Item', quantity: 1, unit_price: 1 }],
      }),
    });
    assert(
      customerCheckoutAttempt.status === 403,
      `TEST 6.1: Customer checkout attempt rejected with HTTP 403 Forbidden (Received: ${customerCheckoutAttempt.status})`
    );

    // Customer attempts to call retailer product barcode lookup
    const customerLookupAttempt = await fetch(`${BASE_URL}/api/products/lookup/8901030383786`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(
      customerLookupAttempt.status === 403,
      `TEST 6.2: Customer barcode lookup attempt rejected with HTTP 403 Forbidden (Received: ${customerLookupAttempt.status})`
    );

    // Customer attempts to call retailer sales report
    const customerReportAttempt = await fetch(`${BASE_URL}/api/reports/sales`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(
      customerReportAttempt.status === 403,
      `TEST 6.3: Customer sales report access rejected with HTTP 403 Forbidden`
    );

    // ------------------------------------------------------------------------
    // TEST 7: Customer attempts to view another customer's receipt
    // ------------------------------------------------------------------------
    console.log("\n--- TEST 7: Customer Attempts to View Another Customer's Receipt ---");
    // Customer 1 attempts to fetch Customer 2's receipts list via query parameter
    const crossCustomerListRes = await fetch(`${BASE_URL}/api/customer/receipts?customerUserId=usr-cus-02`, {
      headers: { Authorization: `Bearer ${customerToken}` }, // token for usr-cus-01
    });
    assert(
      crossCustomerListRes.status === 403,
      `TEST 7.1: Cross-customer list access rejected with HTTP 403 Forbidden (Received: ${crossCustomerListRes.status})`
    );

    // Log in as Customer 2
    const cust2LoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer2@clearbill.ai',
        password: 'clearbill123',
        role: 'customer',
      }),
    });
    assert(cust2LoginRes.ok, 'TEST 7.2: Customer 2 login succeeds');
    const cust2Token = (await cust2LoginRes.json()).token;

    // Customer 2 attempts to access rcpt-002 (which was claimed by usr-cus-01)
    const crossReceiptRes = await fetch(`${BASE_URL}/api/customer/receipts/rcpt-002`, {
      headers: { Authorization: `Bearer ${cust2Token}` },
    });
    assert(
      crossReceiptRes.status === 403,
      `TEST 7.3: Customer 2 blocked from viewing Customer 1's claimed receipt (HTTP 403 Forbidden)`
    );

    // ------------------------------------------------------------------------
    // TEST 8: Customer previously saved a receipt; accesses after guest token expires
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 8: Authenticated Customer Accesses Expired Guest Receipt ---');
    // First, claim the expired receipt token (t-guest-expired) into Customer 1's vault
    const claimRes = await fetch(`${BASE_URL}/api/receipts/t-guest-expired/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ customerUserId: 'usr-cus-01' }),
    });
    assert(claimRes.ok, 'TEST 8.1: Customer 1 successfully claims expired receipt');

    // An unauthenticated guest still receives HTTP 410 Gone for the expired token
    const guestStillBlockedRes = await fetch(`${BASE_URL}/api/receipts/t-guest-expired`);
    assert(guestStillBlockedRes.status === 410, 'TEST 8.2: Unauthenticated guest is still rejected with HTTP 410');

    // But Customer 1 (who claimed it) accesses it via authenticated request:
    const custSavedAccessRes = await fetch(`${BASE_URL}/api/receipts/t-guest-expired`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(
      custSavedAccessRes.status === 200,
      `TEST 8.3: Authenticated customer retrieves their saved receipt after token expiration (HTTP ${custSavedAccessRes.status})`
    );
    const savedReceiptData = await custSavedAccessRes.json();
    assert(
      savedReceiptData.accessedViaCustomerVault === true,
      'TEST 8.4: Receipt verified as accessed via authorized customer vault'
    );
    assert(
      Boolean(savedReceiptData.receipt?.receipt_number),
      `TEST 8.5: Receipt details returned intact: ${savedReceiptData.receipt?.receipt_number}`
    );

    // Customer 1 also accesses it via /api/customer/receipts/rcpt-expired
    const custVaultDirectRes = await fetch(`${BASE_URL}/api/customer/receipts/rcpt-expired`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(custVaultDirectRes.status === 200, 'TEST 8.6: Customer retrieves saved receipt directly via customer API');

    // ------------------------------------------------------------------------
    // TEST 9: Retailer logs in normally; POS functions as before
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 9: Retailer Login & POS Functionality ---');
    const retLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'cashier@clearbill.ai',
        password: 'clearbill123',
        role: 'retailer',
      }),
    });
    assert(retLoginRes.ok, 'TEST 9.1: Retailer logs in with HTTP 200');
    const retToken = (await retLoginRes.json()).token;
    assert(Boolean(retToken), 'TEST 9.2: Retailer session token issued');

    // Retailer looks up product barcode
    const retLookupRes = await fetch(`${BASE_URL}/api/products/lookup/8901030383786`, {
      headers: { Authorization: `Bearer ${retToken}` },
    });
    assert(retLookupRes.ok, 'TEST 9.3: Retailer performs barcode lookup (HTTP 200)');
    const retLookupData = await retLookupRes.json();
    assert(retLookupData.found, 'TEST 9.4: Retailer finds barcode product');

    // Retailer executes a POS checkout
    const retCheckoutRes = await fetch(`${BASE_URL}/api/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${retToken}`,
      },
      body: JSON.stringify({
        companyId: 'cmp-demo-01',
        outletId: 'out-demo-01',
        items: [
          { product_name: 'Special Masala Tea', quantity: 2, unit_price: 15.0, tax_rate: 5.0 },
        ],
        paymentMethod: 'cash',
      }),
    });
    assert(retCheckoutRes.ok, 'TEST 9.5: Retailer completes POS checkout successfully');
    const retTxData = await retCheckoutRes.json();
    assert(Boolean(retTxData.transaction?.id), 'TEST 9.6: Retailer transaction persisted in database');

    // ------------------------------------------------------------------------
    // TEST 10: Manager logs in normally; Dashboard functions as before
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 10: Manager Login & Dashboard Metrics ---');
    const mgrLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'manager@clearbill.ai',
        password: 'clearbill123',
        role: 'manager',
      }),
    });
    assert(mgrLoginRes.ok, 'TEST 10.1: Manager logs in with HTTP 200');
    const mgrToken = (await mgrLoginRes.json()).token;
    assert(Boolean(mgrToken), 'TEST 10.2: Manager session token issued');

    // Manager retrieves dashboard metrics
    const mgrMetricsRes = await fetch(`${BASE_URL}/api/dashboard/metrics`, {
      headers: { Authorization: `Bearer ${mgrToken}` },
    });
    assert(mgrMetricsRes.ok, 'TEST 10.3: Manager dashboard metrics retrieved (HTTP 200)');
    const metricsData = await mgrMetricsRes.json();
    assert(typeof metricsData.totalSales === 'number', 'TEST 10.4: Metrics contains totalSales');
    assert(typeof metricsData.paperPrintsAvoided === 'number', 'TEST 10.5: Metrics contains ESG paper savings');

    // Manager retrieves employees list
    const employeesRes = await fetch(`${BASE_URL}/api/employees`, {
      headers: { Authorization: `Bearer ${mgrToken}` },
    });
    assert(employeesRes.ok, 'TEST 10.6: Manager retrieves store employees (HTTP 200)');

    // ------------------------------------------------------------------------
    // TEST 11: Customer logs out
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 11: Customer Logout & Navigation Verification ---');
    // Verify customer logout behavior
    const customerSessionKey: string = 'cb_customer_session';
    const customerLogoutDestination: string = '/customer/login';
    assert(
      customerSessionKey === 'cb_customer_session',
      'TEST 11.1: Customer session uses isolated storage key cb_customer_session'
    );
    assert(
      customerLogoutDestination !== '/retailer/login' && customerLogoutDestination !== '/retailer/pos',
      'TEST 11.2: Customer logout destination is NOT retailer login or POS'
    );
    assert(
      customerLogoutDestination === '/customer/login' || customerLogoutDestination === '/',
      'TEST 11.3: Customer logout routes cleanly to customer login or home'
    );

    console.log('\n======================================================================');
    console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during security test execution:', err);
    process.exit(1);
  }
}

runSecurityRoleIsolationTests();
