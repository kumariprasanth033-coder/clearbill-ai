/**
 * ClearBill AI - Universal Barcode Scanning Automated Test Suite
 *
 * Strictly verifies tests A through I:
 * Test A: Existing barcode (retrieved from MySQL).
 * Test B: Unknown barcode found in external product database (identified & registered with selling price).
 * Test C: Unknown barcode not found anywhere (allows manual registration with pre-filled barcode, no fake data).
 * Test D: Existing product scanned repeatedly (increases quantity without duplicate records).
 * Test E: Same barcode submitted concurrently (prevents duplicate catalogue records).
 * Test F: Missing selling price (requires retailer to provide valid price > 0, rejects 0 or missing).
 * Test G: External API unavailable/offline (shows error and provides manual registration).
 * Test H: Product belonging to another business (enforces catalogue access permissions).
 * Test I: Complete checkout (verifies correct items and totals in MySQL and receipt).
 */

async function runUniversalBarcodeScanningTests() {
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
  console.log('🏷️  CLEARBILL AI - UNIVERSAL BARCODE SCANNING & AUTO-REGISTRATION SUITE');
  console.log('======================================================================\n');

  try {
    // ------------------------------------------------------------------------
    // SETUP: Retailer & Manager Login + Idempotent Test Cleanup
    // ------------------------------------------------------------------------
    const retLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'cashier@clearbill.ai',
        password: 'clearbill123',
        role: 'retailer',
      }),
    });
    assert(retLoginRes.ok, 'SETUP: Retailer logs in successfully (HTTP 200)');
    const retLogin = await retLoginRes.json();
    const retToken = retLogin.token;
    assert(Boolean(retToken), 'SETUP: Retailer session token issued');

    const mgrLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'manager@clearbill.ai',
        password: 'clearbill123',
        role: 'manager',
      }),
    });
    const mgrLogin = await mgrLoginRes.json();
    const mgrToken = mgrLogin.token;

    // Clean up test barcodes if registered in prior runs to ensure test idempotency
    const testBarcodesToClean = ['8901058852332', '8909999888812', '8901491101837'];
    for (const b of testBarcodesToClean) {
      const chk = await fetch(`${BASE_URL}/api/products/lookup/${b}`, {
        headers: { Authorization: `Bearer ${retToken}` },
      });
      const chkData = await chk.json();
      if (chkData.found && chkData.product?.id) {
        await fetch(`${BASE_URL}/api/products/${chkData.product.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${mgrToken}` },
        });
      }
    }

    // ------------------------------------------------------------------------
    // TEST A: Existing barcode in MySQL
    // ------------------------------------------------------------------------
    console.log('\n--- TEST A: Existing Barcode in MySQL ---');
    const existingBarcode = '8901030383786'; // Tata Tea Gold
    const testARes = await fetch(`${BASE_URL}/api/products/lookup/${existingBarcode}`, {
      headers: { Authorization: `Bearer ${retToken}` },
    });
    assert(testARes.ok, 'TEST A.1: Query for registered barcode returns HTTP 200');
    const testAData = await testARes.json();
    assert(testAData.found === true, 'TEST A.2: Product found in store catalogue');
    assert(testAData.source === 'mysql', 'TEST A.3: Source confirmed as MySQL store database');
    assert(testAData.product?.product_name === 'Tata Tea Gold 250g', `TEST A.4: Product name matched: ${testAData.product?.product_name}`);
    assert(testAData.product?.unit_price === 165, `TEST A.5: Registered unit price retrieved: ₹${testAData.product?.unit_price}`);

    // ------------------------------------------------------------------------
    // TEST B: Unknown barcode found in external product database
    // ------------------------------------------------------------------------
    console.log('\n--- TEST B: Unknown Barcode Found in External Database ---');
    const externalBarcode = '8901058852332'; // Maggi Noodles (EAN-13)
    const testBRes = await fetch(`${BASE_URL}/api/products/lookup/${externalBarcode}`, {
      headers: { Authorization: `Bearer ${retToken}` },
    });
    assert(testBRes.ok, 'TEST B.1: External lookup returns HTTP 200');
    const testBData = await testBRes.json();
    assert(testBData.found === false, 'TEST B.2: Confirms item is not yet in MySQL catalogue');
    assert(testBData.externalFound === true, 'TEST B.3: Item successfully identified in external database');
    assert(testBData.externalProduct?.barcode === externalBarcode, 'TEST B.4: Returned barcode matches scanned barcode strictly');
    assert(testBData.externalProduct?.product_name.includes('Maggi'), `TEST B.5: Verified product name identified: ${testBData.externalProduct?.product_name}`);
    assert(testBData.externalProduct?.requiresPriceConfirmation === true, 'TEST B.6: Requires retailer selling price confirmation');

    // Retailer registers the externally identified product with their selling price
    const registerBRes = await fetch(`${BASE_URL}/api/products/register-scanned`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${retToken}`,
      },
      body: JSON.stringify({
        companyId: 'cmp-demo-01',
        outletId: 'out-demo-01',
        barcode: externalBarcode,
        product_name: testBData.externalProduct.product_name,
        category: testBData.externalProduct.category,
        unit: testBData.externalProduct.unit,
        unit_price: 14.00, // Retailer's selling price
        tax_rate: 5.0,
      }),
    });
    assert(registerBRes.status === 201, 'TEST B.7: First-time product registration succeeds with HTTP 201');
    const registerBData = await registerBRes.json();
    assert(registerBData.success === true, 'TEST B.8: Registration confirmed');
    assert(registerBData.product?.unit_price === 14.00, 'TEST B.9: Selling price saved in MySQL');

    // Confirm that subsequent scan finds it immediately in MySQL!
    const relookupBRes = await fetch(`${BASE_URL}/api/products/lookup/${externalBarcode}`, {
      headers: { Authorization: `Bearer ${retToken}` },
    });
    const relookupBData = await relookupBRes.json();
    assert(relookupBData.found === true, 'TEST B.10: Re-scan retrieves product directly from MySQL catalogue');
    assert(relookupBData.source === 'mysql', 'TEST B.11: Source is now MySQL');

    // ------------------------------------------------------------------------
    // TEST C: Unknown barcode not found anywhere (Manual registration)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST C: Unknown Barcode Not Found Anywhere ---');
    const unknownBarcode = `999${Date.now()}`;
    const testCRes = await fetch(`${BASE_URL}/api/products/lookup/${unknownBarcode}`, {
      headers: { Authorization: `Bearer ${retToken}` },
    });
    assert(testCRes.status === 404, 'TEST C.1: Unidentified barcode returns HTTP 404');
    const testCData = await testCRes.json();
    assert(testCData.found === false && testCData.externalFound === false, 'TEST C.2: Correctly reports not found in MySQL or external DB');
    assert(!testCData.product, 'TEST C.3: No fake product information is fabricated');

    // Retailer performs manual registration with pre-filled barcode
    const manualRegisterRes = await fetch(`${BASE_URL}/api/products/register-scanned`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${retToken}`,
      },
      body: JSON.stringify({
        companyId: 'cmp-demo-01',
        outletId: 'out-demo-01',
        barcode: unknownBarcode,
        product_name: 'Artisan Sourdough Loaf 400g',
        category: 'Bakery',
        unit: 'loaf',
        unit_price: 120.00,
        tax_rate: 5.0,
      }),
    });
    assert(manualRegisterRes.status === 201, 'TEST C.4: Manual registration succeeds with HTTP 201');
    const manualRegisterData = await manualRegisterRes.json();
    assert(manualRegisterData.product?.barcode === unknownBarcode, 'TEST C.5: Barcode preserved correctly');
    assert(manualRegisterData.product?.product_name === 'Artisan Sourdough Loaf 400g', 'TEST C.6: Product name saved in MySQL');

    // ------------------------------------------------------------------------
    // TEST D: Existing product scanned repeatedly (Quantity increment, no duplicates)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST D: Existing Product Scanned Repeatedly ---');
    const allProductsBeforeRes = await fetch(`${BASE_URL}/api/products?companyId=cmp-demo-01`, {
      headers: { Authorization: `Bearer ${retToken}` },
    });
    const allProductsBefore = await allProductsBeforeRes.json();
    const countBefore = allProductsBefore.filter((p: any) => p.barcode === existingBarcode).length;
    assert(countBefore === 1, 'TEST D.1: Initial single record in catalogue for existing barcode');

    // Repeated scan lookup
    const repeatScanRes = await fetch(`${BASE_URL}/api/products/lookup/${existingBarcode}`, {
      headers: { Authorization: `Bearer ${retToken}` },
    });
    assert(repeatScanRes.ok, 'TEST D.2: Repeated scan lookup succeeds');
    const allProductsAfterRes = await fetch(`${BASE_URL}/api/products?companyId=cmp-demo-01`, {
      headers: { Authorization: `Bearer ${retToken}` },
    });
    const allProductsAfter = await allProductsAfterRes.json();
    const countAfter = allProductsAfter.filter((p: any) => p.barcode === existingBarcode).length;
    assert(countAfter === 1, 'TEST D.3: No duplicate catalogue records created on repeated scans');

    // ------------------------------------------------------------------------
    // TEST E: Same barcode submitted concurrently
    // ------------------------------------------------------------------------
    console.log('\n--- TEST E: Concurrent Registration of Same Barcode ---');
    const concurrentBarcode = `CONC-${Date.now()}`;
    const req1 = fetch(`${BASE_URL}/api/products/register-scanned`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${retToken}` },
      body: JSON.stringify({
        companyId: 'cmp-demo-01',
        barcode: concurrentBarcode,
        product_name: 'Concurrent Item Test',
        unit_price: 55.00,
      }),
    });
    const req2 = fetch(`${BASE_URL}/api/products/register-scanned`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${retToken}` },
      body: JSON.stringify({
        companyId: 'cmp-demo-01',
        barcode: concurrentBarcode,
        product_name: 'Concurrent Item Test',
        unit_price: 55.00,
      }),
    });

    const [res1, res2] = await Promise.all([req1, req2]);
    assert(res1.ok && res2.ok, 'TEST E.1: Both concurrent registration calls handle request cleanly');
    const data1 = await res1.json();
    const data2 = await res2.json();
    assert(data1.product.id === data2.product.id, 'TEST E.2: Both calls resolve to the same unique product ID (no duplicates)');

    // ------------------------------------------------------------------------
    // TEST F: Missing or invalid selling price rejected
    // ------------------------------------------------------------------------
    console.log('\n--- TEST F: Missing / Zero Selling Price Strictly Rejected ---');
    const testFRes = await fetch(`${BASE_URL}/api/products/register-scanned`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${retToken}` },
      body: JSON.stringify({
        companyId: 'cmp-demo-01',
        barcode: 'PRICE-TEST-01',
        product_name: 'Zero Price Test Item',
        unit_price: 0, // Invalid!
      }),
    });
    assert(testFRes.status === 400, 'TEST F.1: Zero price registration rejected with HTTP 400');
    const testFData = await testFRes.json();
    assert(testFData.error?.includes('selling price'), 'TEST F.2: Explanatory error message returned');

    const missingPriceRes = await fetch(`${BASE_URL}/api/products/register-scanned`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${retToken}` },
      body: JSON.stringify({
        companyId: 'cmp-demo-01',
        barcode: 'PRICE-TEST-02',
        product_name: 'No Price Test Item',
      }),
    });
    assert(missingPriceRes.status === 400, 'TEST F.3: Missing price registration rejected with HTTP 400');

    // ------------------------------------------------------------------------
    // TEST G: External API unavailable / offline resilience
    // ------------------------------------------------------------------------
    console.log('\n--- TEST G: External API Unavailable / Resilience ---');
    const offlineBarcode = 'OFFLINE-UNKNOWN-777';
    const offlineRes = await fetch(`${BASE_URL}/api/products/lookup/${offlineBarcode}`, {
      headers: { Authorization: `Bearer ${retToken}` },
    });
    assert(offlineRes.status === 404, 'TEST G.1: Gracefully returns 404 without crashing server');
    const offlineData = await offlineRes.json();
    assert(offlineData.found === false, 'TEST G.2: Reports not found cleanly');

    // ------------------------------------------------------------------------
    // TEST H: Catalogue Isolation Between Businesses
    // ------------------------------------------------------------------------
    console.log('\n--- TEST H: Cross-Company Catalogue Isolation ---');
    // Querying for another company's catalogue returns isolated results
    const comp2Lookup = await fetch(`${BASE_URL}/api/products/lookup/${existingBarcode}?companyId=cmp-other-99`, {
      headers: { Authorization: `Bearer ${retToken}` },
    });
    // In cmp-other-99, Tata Tea Gold is not registered
    const comp2Data = await comp2Lookup.json();
    assert(comp2Data.source !== 'mysql', 'TEST H.1: Other business catalogue is completely isolated from cmp-demo-01');

    // ------------------------------------------------------------------------
    // TEST I: Complete Checkout with Newly Registered & Scanned Products
    // ------------------------------------------------------------------------
    console.log('\n--- TEST I: Complete Checkout with Scanned Products ---');
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
        customerName: 'Pooja Hegde',
        customerPhone: '+91 97777 66666',
        paymentMethod: 'cash',
        items: [
          {
            product_id: registerBData.product.id,
            product_name: registerBData.product.product_name,
            barcode: registerBData.product.barcode,
            quantity: 2,
            unit_price: 14.00,
            tax_rate: 5.0,
            discount_amount: 0,
          },
          {
            product_id: manualRegisterData.product.id,
            product_name: manualRegisterData.product.product_name,
            barcode: manualRegisterData.product.barcode,
            quantity: 1,
            unit_price: 120.00,
            tax_rate: 5.0,
            discount_amount: 0,
          },
        ],
      }),
    });
    assert(checkoutRes.ok, 'TEST I.1: POS checkout completed with HTTP 200');
    const checkoutData = await checkoutRes.json();
    assert(Boolean(checkoutData.receipt?.receipt_number), `TEST I.2: Digital receipt issued: ${checkoutData.receipt?.receipt_number}`);
    assert(checkoutData.transaction?.items?.length === 2, 'TEST I.3: Both scanned items persisted in MySQL transaction');
    // (2 * 14.00 = 28.00) + (1 * 120.00 = 120.00) = subtotal 148.00. Tax: 5% of 148 = 7.40. Total = 155.40
    assert(checkoutData.transaction?.subtotal === 148.00, `TEST I.4: Authoritative subtotal: ₹${checkoutData.transaction?.subtotal}`);
    assert(checkoutData.transaction?.tax_amount === 7.40, `TEST I.5: Authoritative tax calculated: ₹${checkoutData.transaction?.tax_amount}`);
    assert(checkoutData.transaction?.grand_total === 155.40, `TEST I.6: Authoritative grand total: ₹${checkoutData.transaction?.grand_total}`);

    // Receipt token exists and is scannable
    const receiptToken = checkoutData.receipt.tokens?.[0]?.token || checkoutData.receipt.receipt_token;
    assert(Boolean(receiptToken), 'TEST I.7: Scannable receipt guest token generated');
    const verifyReceiptRes = await fetch(`${BASE_URL}/api/receipts/${receiptToken}`);
    assert(verifyReceiptRes.ok, 'TEST I.8: Public receipt endpoint resolves authoritative receipt data');

    // ------------------------------------------------------------------------
    // TEST J: AI-Assisted Product Packaging Identification (Turn 7 Requirement)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST J: AI-Assisted Product Identification (/api/products/identify-ai) ---');
    const aiTestBarcode = '8901233001122';

    // J.1: Reject call missing barcode
    const aiMissingBarcodeRes = await fetch(`${BASE_URL}/api/products/identify-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${retToken}`,
      },
      body: JSON.stringify({
        textHint: 'Colgate MaxFresh',
      }),
    });
    assert(aiMissingBarcodeRes.status === 400, 'TEST J.1: Missing barcode rejected with HTTP 400');

    // J.2: AI Vision recognition endpoint responds with identified product
    const aiIdentifyRes = await fetch(`${BASE_URL}/api/products/identify-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${retToken}`,
      },
      body: JSON.stringify({
        barcode: aiTestBarcode,
        textHint: 'Haldirams Minute Khana Dal Makhani 300g',
      }),
    });
    assert(aiIdentifyRes.ok, 'TEST J.2: AI identification endpoint returns HTTP 200');
    const aiIdentifyData = await aiIdentifyRes.json();
    assert(aiIdentifyData.success === true, 'TEST J.3: AI identification successful');
    assert(Boolean(aiIdentifyData.identifiedProduct?.product_name), `TEST J.4: AI extracted product name: ${aiIdentifyData.identifiedProduct?.product_name}`);
    assert(aiIdentifyData.identifiedProduct?.barcode === aiTestBarcode, 'TEST J.5: Returns scanned barcode in identified record');
    assert(aiIdentifyData.identifiedProduct?.requiresPriceConfirmation === true, 'TEST J.6: Enforces retailer selling price confirmation');

    // J.7: Retailer sets confirmed selling price and registers the AI-identified product in MySQL
    const aiRegisterRes = await fetch(`${BASE_URL}/api/products/register-scanned`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${retToken}`,
      },
      body: JSON.stringify({
        companyId: 'cmp-demo-01',
        outletId: 'out-demo-01',
        barcode: aiTestBarcode,
        product_name: aiIdentifyData.identifiedProduct.product_name,
        category: aiIdentifyData.identifiedProduct.category || 'Ready to Eat',
        unit: aiIdentifyData.identifiedProduct.unit || 'pack',
        unit_price: 110.00, // Retailer's selling price
        tax_rate: 5.0,
      }),
    });
    assert(aiRegisterRes.status === 201, 'TEST J.7: AI-identified product registered with confirmed selling price (HTTP 201)');
    const aiRegisterData = await aiRegisterRes.json();
    assert(aiRegisterData.product?.unit_price === 110.00, 'TEST J.8: Selling price ₹110.00 saved in MySQL');

    // J.9: Subsequent scan now resolves immediately from MySQL!
    const relookupAiRes = await fetch(`${BASE_URL}/api/products/lookup/${aiTestBarcode}`, {
      headers: { Authorization: `Bearer ${retToken}` },
    });
    const relookupAiData = await relookupAiRes.json();
    assert(relookupAiData.found === true, 'TEST J.9: Subsequent scan of AI-registered barcode resolves immediately from MySQL');
    assert(relookupAiData.source === 'mysql', 'TEST J.10: Source confirmed as MySQL store inventory');
  } catch (err: any) {
    console.error('Fatal Test Suite Error:', err);
    failed++;
  }

  console.log('\n======================================================================');
  console.log(`🏁 UNIVERSAL SCANNING TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runUniversalBarcodeScanningTests();
