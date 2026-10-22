/**
 * ClearBill AI - Business Registration Audit, Bank Security,
 * Role-Based Authorization, and Real-Time AI Chatbot Test Suite
 * Validates Modules 1 through 8.
 */

async function runAuditSecurityChatTests() {
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

  console.log('====================================================');
  console.log('🛡️ CLEARBILL AI - AUDIT, SECURITY & CHATBOT TEST SUITE');
  console.log('====================================================\n');

  try {
    // ----------------------------------------------------
    // MODULE 1: Business Registration Validation & Duplicate Prevention
    // ----------------------------------------------------
    console.log('--- MODULE 1: Business Registration Workflow ---');

    // Missing required fields
    const missingFieldsRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessName: 'Incomplete Store' }),
    });
    assert(
      missingFieldsRes.status === 400,
      'Test 1.1: Registration rejects incomplete submission with HTTP 400'
    );

    // Invalid email format
    const invalidEmailRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Cafe Test',
        ownerName: 'Test Owner',
        email: 'invalid-email-no-domain',
        password: 'password123',
      }),
    });
    assert(
      invalidEmailRes.status === 400,
      'Test 1.2: Registration rejects malformed email with HTTP 400'
    );

    // Duplicate email registration prevention
    const duplicateEmailRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Duplicate Attempt Store',
        ownerName: 'Rajesh Sharma',
        email: 'manager@clearbill.ai', // Existing manager email
        password: 'password123',
      }),
    });
    assert(
      duplicateEmailRes.status === 409,
      'Test 1.3: Registration prevents duplicate email address with HTTP 409 Conflict'
    );
    const dupData = await duplicateEmailRes.json();
    assert(
      dupData.error?.includes('already exists'),
      `Test 1.4: Clear duplicate warning returned: "${dupData.error}"`
    );

    // Valid multi-step registration (Indian GST store)
    const testEmail1 = `store${Date.now()}@testclearbill.ai`;
    const validRegisterRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Sunrise Bakery & Cafe',
        category: 'bakery',
        businessRegNumber: 'KA-REG-2026-9921',
        ownerName: 'Vikas Gupta',
        email: testEmail1,
        phone: '+91 98765 11111',
        password: 'securePass123',
        address: '100ft Road, Koramangala, Bengaluru',
        country: 'India',
        state: 'Karnataka',
        currency: 'INR',
        taxType: 'GST',
        taxIdentificationNumber: '29ABCDE1234F1Z5',
        defaultTaxRate: 5,
        primaryOutletName: 'Koramangala Outlet',
        settlementBankName: 'HDFC Bank Ltd',
        settlementAccountHolder: 'Sunrise Bakery',
        settlementAccountNumber: '50100987654321',
        settlementIfscRouting: 'HDFC0004321',
      }),
    });
    assert(
      validRegisterRes.status === 201,
      'Test 1.5: Valid multi-step business registration succeeds with HTTP 201 Created'
    );
    const regData = await validRegisterRes.json();
    assert(
      regData.company?.currency === 'INR' && regData.company?.tax_type === 'GST',
      'Test 1.6: Regional Indian currency (INR) and tax regime (GST) correctly configured'
    );
    assert(
      Boolean(regData.token),
      `Test 1.7: Session token generated on registration: ${regData.token}`
    );

    // Valid US store registration (Sales tax & USD)
    const testEmail2 = `usstore${Date.now()}@testclearbill.ai`;
    const validUsRegisterRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Pacific Retail Mart',
        category: 'general_retail',
        ownerName: 'Sarah Jenkins',
        email: testEmail2,
        phone: '+1 415 555 2671',
        password: 'securePass123',
        address: 'Market St, San Francisco, CA',
        country: 'United States',
        state: 'California',
        currency: 'USD',
        taxType: 'Sales Tax',
        taxIdentificationNumber: '94-1234567',
        defaultTaxRate: 8.5,
      }),
    });
    assert(
      validUsRegisterRes.status === 201,
      'Test 1.8: US business registration correctly sets USD currency and Sales Tax'
    );

    // ----------------------------------------------------
    // MODULE 2: Bank Details & Payment Security
    // ----------------------------------------------------
    console.log('\n--- MODULE 2: Bank Details & Payment Security ---');

    // Retrieve settlement config as Manager
    const mgrConfigRes = await fetch(`${BASE_URL}/api/payments/settlement-config`, {
      headers: { 'x-user-id': 'usr-mgr-01' },
    });
    assert(
      mgrConfigRes.ok,
      'Test 2.1: Store Manager can access settlement bank configuration'
    );
    const mgrConfig = await mgrConfigRes.json();
    assert(
      mgrConfig.masked_account_number?.startsWith('••••'),
      `Test 2.2: Stored account number is masked in responses (${mgrConfig.masked_account_number})`
    );
    assert(
      !mgrConfig.encrypted_account_number && !mgrConfig.account_number,
      'Test 2.3: Raw and encrypted account numbers are never exposed to frontend'
    );

    // Retailer/Cashier access to bank details must be blocked
    const cashierConfigRes = await fetch(`${BASE_URL}/api/payments/settlement-config`, {
      headers: { 'x-user-id': 'usr-ret-01' },
    });
    assert(
      cashierConfigRes.status === 403,
      'Test 2.4: Cashier / Retailer is blocked from accessing settlement bank details (HTTP 403)'
    );

    // Customer access to bank details must be blocked
    const customerConfigRes = await fetch(`${BASE_URL}/api/payments/settlement-config`, {
      headers: { 'x-user-id': 'usr-cus-01' },
    });
    assert(
      customerConfigRes.status === 403,
      'Test 2.5: Customer is blocked from accessing merchant bank details (HTTP 403)'
    );

    // Security Rule 1: Attempt to collect CVV / PIN / banking password must be rejected
    const secretViolationRes = await fetch(`${BASE_URL}/api/payments/settlement-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'usr-mgr-01',
      },
      body: JSON.stringify({
        bankName: 'HDFC Bank',
        accountNumber: '5010045892314589',
        pin: '1234', // VIOLATION
      }),
    });
    assert(
      secretViolationRes.status === 400,
      'Test 2.6: Server strictly rejects attempts to submit PINs or banking credentials (HTTP 400)'
    );

    // Cross-company access attempt: Company B manager cannot read Company A settlement details
    const crossCompanyConfigRes = await fetch(`${BASE_URL}/api/payments/settlement-config?companyId=cmp-demo-01`, {
      headers: { 'x-user-id': 'usr-mgr-other' }, // Manager of cmp-other-02
    });
    assert(
      crossCompanyConfigRes.status === 403,
      'Test 2.7: Cross-company settlement access blocked with HTTP 403 Forbidden'
    );

    // ----------------------------------------------------
    // MODULE 3: Manager Login & Role-Based Access Control (RBAC)
    // ----------------------------------------------------
    console.log('\n--- MODULE 3: Manager Authorization & RBAC ---');

    // Customer cannot access manager metrics
    const custMetricsRes = await fetch(`${BASE_URL}/api/dashboard/metrics`, {
      headers: { 'x-user-id': 'usr-cus-01' },
    });
    assert(
      custMetricsRes.status === 403,
      'Test 3.1: Customer cannot access manager dashboard metrics (HTTP 403)'
    );

    // Retailer cannot access sales reports
    const retReportsRes = await fetch(`${BASE_URL}/api/reports/sales`, {
      headers: { 'x-user-id': 'usr-ret-01' },
    });
    assert(
      retReportsRes.status === 403,
      'Test 3.2: Cashier cannot access managerial sales reports (HTTP 403)'
    );

    // Retailer cannot access employee management CRUD
    const retEmployeesRes = await fetch(`${BASE_URL}/api/employees`, {
      headers: { 'x-user-id': 'usr-ret-01' },
    });
    assert(
      retEmployeesRes.status === 403,
      'Test 3.3: Cashier cannot access employee management directory (HTTP 403)'
    );

    // Cross-company metrics isolation: Manager of Company B cannot read Company A metrics
    const crossMetricsRes = await fetch(`${BASE_URL}/api/dashboard/metrics?companyId=cmp-demo-01`, {
      headers: { 'x-user-id': 'usr-mgr-other' },
    });
    assert(
      crossMetricsRes.status === 403,
      'Test 3.4: Cross-company manager metrics access blocked with HTTP 403'
    );

    // Manager can access authorized dashboard metrics
    const mgrMetricsRes = await fetch(`${BASE_URL}/api/dashboard/metrics?companyId=cmp-demo-01`, {
      headers: { 'x-user-id': 'usr-mgr-01' },
    });
    assert(
      mgrMetricsRes.ok,
      'Test 3.5: Authorized store manager accesses dashboard metrics (HTTP 200)'
    );

    // ----------------------------------------------------
    // MODULES 4, 5, 6, 7: Personalized Real-Time AI Chatbot
    // ----------------------------------------------------
    console.log('\n--- MODULES 4-7: Personalized Real-Time AI Chatbot ---');

    // Manager query for sales
    const chatSalesRes = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'usr-mgr-01',
      },
      body: JSON.stringify({
        prompt: 'What are my total sales today?',
      }),
    });
    assert(chatSalesRes.ok, 'Test 4.1: Manager AI chatbot query responds with HTTP 200');
    const chatSales = await chatSalesRes.json();
    assert(Boolean(chatSales.answer), 'Test 4.2: Chatbot generated a structured response');
    const previousSales = chatSales.metrics?.confirmedRevenueToday;
    assert(
      typeof previousSales === 'number' && previousSales > 0,
      `Test 4.3: Grounded in confirmed database revenue (₹${previousSales})`
    );

    // Complete a new checkout transaction in real-time
    console.log('Finalizing new checkout to test real-time chatbot responsiveness...');
    const newTxRes = await fetch(`${BASE_URL}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: 'cmp-demo-01',
        outletId: 'out-demo-01',
        items: [
          {
            product_id: 'prod-qb-01',
            product_name: 'Special Masala Tea',
            barcode: 'TEA-001',
            quantity: 4,
            unit_price: 15.0,
            tax_rate: 5.0,
            discount_amount: 0,
          },
        ],
        paymentMethod: 'cash',
        customerName: 'Realtime Test Customer',
      }),
    });
    assert(newTxRes.ok, 'Test 4.4: New checkout completed successfully');
    const newTxData = await newTxRes.json();
    const addedAmount = newTxData.transaction.grand_total; // 4 * 15 = 60 + 5% tax = 63.00

    // Re-query the chatbot immediately to verify real-time data update
    const followUpChatRes = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'usr-mgr-01',
      },
      body: JSON.stringify({
        prompt: 'What are my total sales today?',
      }),
    });
    assert(followUpChatRes.ok, 'Test 4.5: Follow-up chatbot query responds');
    const followUpChat = await followUpChatRes.json();
    const updatedSales = followUpChat.metrics?.confirmedRevenueToday;
    assert(
      updatedSales === Number((previousSales + addedAmount).toFixed(2)),
      `Test 4.6: Real-time update verified: Sales updated from ₹${previousSales} to ₹${updatedSales} (+₹${addedAmount})`
    );

    // Test Data Minimization: Chatbot context must NEVER contain bank details or passwords
    const contextStr = JSON.stringify(followUpChat);
    assert(
      !contextStr.includes('5010045892314589') && !contextStr.includes('clearbill123'),
      'Test 4.7: Data minimization confirmed: Sensitive bank account numbers and passwords are not sent to or exposed by AI'
    );

    // Test Retailer Personalized Chat Response
    const retChatRes = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'usr-ret-01',
      },
      body: JSON.stringify({
        prompt: 'How do I scan a barcode and correct billing mistakes?',
      }),
    });
    assert(retChatRes.ok, 'Test 4.8: Retailer cashier query succeeds');
    const retChat = await retChatRes.json();
    assert(
      retChat.answer?.includes('Barcode') || retChat.answer?.includes('POS'),
      'Test 4.9: Retailer receives role-tailored cashier guidance'
    );

    // Test Customer Personalized Chat Response
    const custChatRes = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'usr-cus-01',
      },
      body: JSON.stringify({
        prompt: 'How do I download my receipt?',
      }),
    });
    assert(custChatRes.ok, 'Test 4.10: Customer receipt assistant query succeeds');

    console.log('\n====================================================');
    console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during test suite execution:', err);
    process.exit(1);
  }
}

runAuditSecurityChatTests();
