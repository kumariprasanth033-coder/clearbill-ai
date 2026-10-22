/**
 * ClearBill AI - Automated End-to-End System Test Suite
 * Tests full-stack API functionality, database fallbacks, barcode normalization,
 * decimal-safe checkout calculations, digital receipt tokens, customer claims, and reporting.
 */

async function runTestSuite() {
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
  console.log('🚀 CLEARBILL AI - COMPREHENSIVE TEST SUITE');
  console.log('====================================================\n');

  try {
    // 1. Health and DB Status Check
    console.log('--- 1. Database Connection & System Health ---');
    const dbRes = await fetch(`${BASE_URL}/api/db/status`);
    assert(dbRes.ok, 'DB Status endpoint responds with HTTP 200');
    const dbData = await dbRes.json();
    assert(
      typeof dbData.isConnected === 'boolean' && (dbData.engine === 'mysql' || dbData.engine === 'memory_fallback'),
      `DB operational state: isConnected=${dbData.isConnected} (Engine: ${dbData.engine})`
    );
    assert(dbData.tablesCount >= 28, `Database schema active (${dbData.tablesCount} tables available)`);

    // 2. Barcode Lookups (EAN-13, EAN-8, UPC-A with leading zeros, Code 128)
    console.log('\n--- 2. Barcode Normalization & Product Lookups ---');
    
    // EAN-13
    const eanRes = await fetch(`${BASE_URL}/api/products/lookup/8901030383786`);
    assert(eanRes.ok, 'Lookup Tata Tea Gold (EAN-13: 8901030383786)');
    const eanData = await eanRes.json();
    assert(eanData.found === true && eanData.product?.product_name === 'Tata Tea Gold 250g', 'Correct product name matched for EAN-13');
    assert(eanData.product?.unit_price === 165.0, 'Correct price matched for EAN-13 (₹165.00)');

    // UPC-A with Leading Zero Preservation
    const upcRes = await fetch(`${BASE_URL}/api/products/lookup/012345678905`);
    assert(upcRes.ok, 'Lookup Organic Honey (UPC-A with leading zero: 012345678905)');
    const upcData = await upcRes.json();
    assert(upcData.product?.barcode === '012345678905', 'Preserved leading zero in barcode field (012345678905)');
    assert(upcData.product?.product_name?.includes('Organic Honey'), 'Correct product name matched for UPC-A');

    // Code 128 Alphanumeric
    const code128Res = await fetch(`${BASE_URL}/api/products/lookup/CB-RETAIL-1001`);
    assert(code128Res.ok, 'Lookup Stainless Flask (Code 128: CB-RETAIL-1001)');
    const code128Data = await code128Res.json();
    assert(code128Data.product?.product_name?.includes('Stainless Steel Insulated Flask'), 'Correct product for Code 128');

    // 404 for Unregistered Barcode
    const unknownRes = await fetch(`${BASE_URL}/api/products/lookup/9999999999999`);
    assert(unknownRes.status === 404, 'Unregistered barcode returns HTTP 404');

    // 3. Billing Fields Configuration Endpoint
    console.log('\n--- 3. Billing Fields Customizer Persistence ---');
    const configRes = await fetch(`${BASE_URL}/api/billing/configs`);
    assert(configRes.ok, 'Fetched billing field configs');
    const configs = await configRes.json();
    assert(Array.isArray(configs) && configs.length >= 8, `Loaded ${configs.length} field configuration rules`);

    // 4. Authoritative Checkout Calculations & Decimal Safety
    console.log('\n--- 4. Authoritative Bill Checkout & Calculations ---');
    
    // Empty checkout guard
    const emptyCheckoutRes = await fetch(`${BASE_URL}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [] }),
    });
    assert(emptyCheckoutRes.status === 400, 'Rejects empty bill checkout with HTTP 400');

    // Real transaction checkout
    const checkoutPayload = {
      companyId: 'cmp-demo-01',
      outletId: 'out-demo-01',
      userId: 'usr-ret-01',
      discountAmount: 10.0,
      paymentMethod: 'upi',
      customerName: 'Priya Sharma',
      customerPhone: '+91 98765 43210',
      items: [
        {
          product_id: eanData.product.id,
          barcode: eanData.product.barcode,
          product_name: eanData.product.product_name,
          quantity: 2,
          unit_price: 165.0,
          tax_rate: 5.0,
          discount_amount: 0,
        },
        {
          product_id: upcData.product.id,
          barcode: upcData.product.barcode,
          product_name: upcData.product.product_name,
          quantity: 1,
          unit_price: 240.0,
          tax_rate: 5.0,
          discount_amount: 0,
        },
      ],
    };

    const checkoutRes = await fetch(`${BASE_URL}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkoutPayload),
    });

    assert(checkoutRes.ok, 'Checkout completed successfully with HTTP 200');
    const checkoutData = await checkoutRes.json();
    assert(Boolean(checkoutData.receipt?.receipt_token), `Receipt token generated: ${checkoutData.receipt?.receipt_token}`);
    assert(Boolean(checkoutData.transaction?.transaction_number), `Invoice number generated: ${checkoutData.transaction?.transaction_number}`);

    // Verify Server-Authoritative Math
    // Item 1: 2 * 165.0 = 330.00, Tax (5%) = 16.50
    // Item 2: 1 * 240.0 = 240.00, Tax (5%) = 12.00
    // Subtotal: 570.00, Tax: 28.50, Discount: 10.00 => Total: 588.50
    assert(checkoutData.transaction.subtotal === 570.0, `Subtotal verified: ₹${checkoutData.transaction.subtotal}`);
    assert(checkoutData.transaction.tax_amount === 28.5, `Tax amount verified: ₹${checkoutData.transaction.tax_amount}`);
    assert(checkoutData.transaction.grand_total === 588.5, `Grand total with discount verified: ₹${checkoutData.transaction.grand_total}`);

    // 5. Digital Receipt Access via Token
    console.log('\n--- 5. Digital Receipt Viewing & Guest Access ---');
    const token = checkoutData.receipt.receipt_token;
    const receiptRes = await fetch(`${BASE_URL}/api/receipts/${token}`);
    assert(receiptRes.ok, 'Receipt accessed via token');
    const receiptData = await receiptRes.json();
    assert(
      receiptData.transaction.transaction_number === checkoutData.transaction.transaction_number,
      'Receipt invoice matches checkout invoice'
    );
    assert(receiptData.transaction.items.length === 2, 'Receipt contains all 2 purchased line items');
    assert(receiptData.receipt.paper_grams_saved >= 2.5, `Paper saved tracked: ${receiptData.receipt.paper_grams_saved}g`);

    // 6. Customer Vault Claiming
    console.log('\n--- 6. Customer Receipt Claiming & Vault ---');
    const claimRes = await fetch(`${BASE_URL}/api/receipts/${token}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerUserId: 'usr-cus-01' }),
    });
    assert(claimRes.ok, 'Receipt claimed by Customer ID usr-cus-01');

    const customerReceiptsRes = await fetch(`${BASE_URL}/api/customer/receipts?customerUserId=usr-cus-01`);
    assert(customerReceiptsRes.ok, 'Customer vault receipts retrieved');
    const customerReceipts = await customerReceiptsRes.json();
    assert(
      customerReceipts.some((r: any) => r.transaction?.transaction_number === checkoutData.transaction.transaction_number),
      'Claimed receipt appears in customer digital vault'
    );

    // 7. Manager Metrics & Sales Reports
    console.log('\n--- 7. Analytics, Dashboard & Reports ---');
    const metricsRes = await fetch(`${BASE_URL}/api/dashboard/metrics`);
    assert(metricsRes.ok, 'Dashboard KPI metrics endpoint responds');
    const metrics = await metricsRes.json();
    assert(metrics.transactionsCount > 0, `Total transactions tracked: ${metrics.transactionsCount}`);
    assert(metrics.paperSavedGrams > 0, `Total paper saved: ${metrics.paperSavedGrams}g`);

    const salesRes = await fetch(`${BASE_URL}/api/reports/sales?period=monthly`);
    assert(salesRes.ok, 'Sales report endpoint responds');
    const salesReport = await salesRes.json();
    assert(salesReport.transactions.length > 0, `Sales report generated with ${salesReport.transactions.length} rows`);

    // 8. Payment Gateway Verification Sandbox
    console.log('\n--- 8. Payment Gateway Simulation ---');
    const payRes = await fetch(`${BASE_URL}/api/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionId: checkoutData.transaction.id,
        paymentMethod: 'upi',
        amount: checkoutData.transaction.grand_total,
        upiRef: 'UPI_REF_987654321',
      }),
    });
    assert(payRes.ok, 'Payment verification sandbox returned success');

    // 9. Employee CRUD Operations (Manager Portal)
    console.log('\n--- 9. Employee Management (CRUD) for Manager ---');
    
    // GET employees
    const empListRes = await fetch(`${BASE_URL}/api/employees`);
    assert(empListRes.ok, 'GET /api/employees directory responds with HTTP 200');
    const employees = await empListRes.json();
    assert(Array.isArray(employees) && employees.length >= 3, `Initial employee directory contains ${employees.length} members`);

    // POST create employee
    const newEmpPayload = {
      name: 'Anjali Sharma',
      email: 'anjali.cashier@clearbill.ai',
      phone: '+91 98765 11223',
      role: 'Cashier / Retailer',
      outlet_name: 'MG Road Flagship Store (BLR-01)',
      code: 'EMP-009',
      is_active: true,
    };
    const addEmpRes = await fetch(`${BASE_URL}/api/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEmpPayload),
    });
    assert(addEmpRes.status === 201, 'POST /api/employees created new employee (HTTP 201)');
    const createdEmp = await addEmpRes.json();
    assert(createdEmp.name === newEmpPayload.name, 'Created employee name matches');
    assert(createdEmp.code === newEmpPayload.code, 'Created employee code matches');

    // PUT edit/update employee
    const updateEmpRes = await fetch(`${BASE_URL}/api/employees/${createdEmp.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...createdEmp,
        role: 'Manager',
        outlet_name: 'Indiranagar Express Outlet (BLR-02)',
      }),
    });
    assert(updateEmpRes.ok, 'PUT /api/employees/:id updated employee (HTTP 200)');
    const updatedEmp = await updateEmpRes.json();
    assert(updatedEmp.role === 'Manager', 'Updated employee role to Manager');
    assert(updatedEmp.outlet_name === 'Indiranagar Express Outlet (BLR-02)', 'Updated employee assigned outlet');

    // DELETE remove employee
    const delEmpRes = await fetch(`${BASE_URL}/api/employees/${createdEmp.id}`, {
      method: 'DELETE',
    });
    assert(delEmpRes.ok, 'DELETE /api/employees/:id removed employee (HTTP 200)');
    const delData = await delEmpRes.json();
    assert(delData.success === true, 'Delete response confirmed success');

    // Verify removed from directory
    const verifyListRes = await fetch(`${BASE_URL}/api/employees`);
    const verifiedList = await verifyListRes.json();
    assert(!verifiedList.some((e: any) => e.id === createdEmp.id), 'Deleted employee no longer exists in directory');

  } catch (error) {
    console.error('Fatal test error:', error);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite();
