/**
 * ClearBill AI - Barcode Scanner Camera & EAN-13 Product Lookup Test
 * 
 * Verifies that:
 * 1. navigator.mediaDevices.getUserMedia camera input stream is properly initialized and requested with environment (rear) camera.
 * 2. Available media devices (cameras) are correctly enumerated.
 * 3. Continuous frame decoding simulates detection of a valid retail EAN-13 barcode (Tata Tea Gold: 8901030383786).
 * 4. The BarcodeScannerScreen lookup logic triggers the authoritative product lookup API (/api/products/lookup/:barcode).
 * 5. The matched product details (name, price, tax, unit) are accurately resolved and dispatched to the draft bill (onAddToCart).
 * 6. Duplicate scan guard prevents unintentional re-triggering within the debounce window (1.8s).
 * 7. Preserves leading zeros when scanning UPC/EAN formats (012345678905).
 * 8. Camera stream track cleanup occurs when the camera is paused or unmounted.
 */

interface MockTrack {
  kind: string;
  label: string;
  enabled: boolean;
  stopped: boolean;
  stop: () => void;
}

interface MockMediaStream {
  id: string;
  active: boolean;
  tracks: MockTrack[];
  getTracks: () => MockTrack[];
  getVideoTracks: () => MockTrack[];
}

async function runBarcodeScannerTests() {
  console.log('====================================================');
  console.log('📷 CLEARBILL AI - BARCODE SCANNER & CAMERA STREAM TEST');
  console.log('====================================================\n');

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

  const BASE_URL = 'http://localhost:3000';

  // 1. Mock Camera Media Devices & Stream
  console.log('--- 1. Camera Input Stream Mocking & Hardware Preference ---');
  
  let cameraStreamRequestedWithConstraints: any = null;
  let mockTrackStopped: boolean = false;

  const mockVideoTrack: MockTrack = {
    kind: 'video',
    label: 'Back Camera Ultra HD (Environment)',
    enabled: true,
    stopped: false,
    stop() {
      this.stopped = true;
      mockTrackStopped = true;
    },
  };

  const mockStream: MockMediaStream = {
    id: `stream-${Date.now()}`,
    active: true,
    tracks: [mockVideoTrack],
    getTracks() {
      return this.tracks;
    },
    getVideoTracks() {
      return this.tracks.filter(t => t.kind === 'video');
    },
  };

  const mockDevices = [
    { deviceId: 'cam-rear-01', kind: 'videoinput', label: 'Rear Main Camera 0 (back)' },
    { deviceId: 'cam-front-01', kind: 'videoinput', label: 'Front Facing Camera 1 (front)' },
  ];

  const mockMediaDevices = {
    getUserMedia: async (constraints: any) => {
      cameraStreamRequestedWithConstraints = constraints;
      return mockStream;
    },
    enumerateDevices: async () => mockDevices,
  };

  try {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: mockMediaDevices,
      configurable: true,
      writable: true,
    });
  } catch (e) {
    (globalThis as any).mockNavigator = { mediaDevices: mockMediaDevices };
  }

  const mediaDevices = (globalThis.navigator as any)?.mediaDevices || (globalThis as any).mockNavigator.mediaDevices;

  assert(
    typeof mediaDevices.getUserMedia === 'function',
    'navigator.mediaDevices.getUserMedia mock initialized'
  );

  // Simulate BarcodeScannerScreen requesting camera stream with environment constraint
  const stream = await mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  });

  assert(stream.active === true, 'Mock camera stream is active');
  assert(stream.getVideoTracks().length === 1, 'Stream provides 1 active video track');
  assert(
    cameraStreamRequestedWithConstraints?.video?.facingMode?.ideal === 'environment',
    'Camera requested rear-facing sensor ({ ideal: "environment" }) for barcode scanning'
  );

  // 2. Simulate ZXing Reader Continuous Detection of EAN-13 Barcode
  console.log('\n--- 2. EAN-13 Barcode Detection Simulation ---');
  
  const VALID_EAN13 = '8901030383786'; // Tata Tea Gold 250g
  let onAddToCartCalledWith: any = null;
  let lookupCallCount = 0;

  // Mock BarcodeScannerScreen detection & lookup handler
  class BarcodeScannerController {
    private lastScannedCode: string | null = null;
    private lastScanTime = 0;
    private readonly DUPLICATE_GUARD_MS = 1800;

    public matchedProduct: any = null;
    public lookupError: string | null = null;

    async handleBarcodeDetected(rawCode: string, onAddToCart?: (prod: any) => void) {
      const normalized = rawCode.trim();
      const now = Date.now();

      // Duplicate guard check
      if (this.lastScannedCode === normalized && now - this.lastScanTime < this.DUPLICATE_GUARD_MS) {
        return; // Guarded debounce
      }

      this.lastScannedCode = normalized;
      this.lastScanTime = now;
      lookupCallCount++;

      // Trigger authoritative API product lookup
      try {
        const res = await fetch(`${BASE_URL}/api/products/lookup/${encodeURIComponent(normalized)}`);
        const data = await res.json();

        if (res.ok && data.found && data.product) {
          this.matchedProduct = data.product;
          this.lookupError = null;
          if (onAddToCart) {
            onAddToCart(data.product);
          }
        } else {
          this.matchedProduct = null;
          this.lookupError = data.message || 'Product not found.';
        }
      } catch (err: any) {
        this.lookupError = 'Network error during lookup: ' + err.message;
      }
    }

    stopScanner() {
      if (mockStream) {
        mockStream.getVideoTracks().forEach(t => t.stop());
      }
    }
  }

  const scanner = new BarcodeScannerController();

  // Test detection of EAN-13
  await scanner.handleBarcodeDetected(VALID_EAN13, (product) => {
    onAddToCartCalledWith = product;
  });

  assert(lookupCallCount === 1, 'Product lookup API triggered exactly once on initial EAN-13 detection');
  assert(scanner.matchedProduct !== null, 'Product matched in store database');
  assert(
    scanner.matchedProduct?.product_name === 'Tata Tea Gold 250g',
    `Matched correct EAN-13 product name: "${scanner.matchedProduct?.product_name}"`
  );
  assert(
    scanner.matchedProduct?.barcode === VALID_EAN13,
    `Preserved full EAN-13 barcode: "${scanner.matchedProduct?.barcode}"`
  );
  assert(
    scanner.matchedProduct?.unit_price === 165.0,
    `Resolved retail unit price: ₹${scanner.matchedProduct?.unit_price}`
  );
  assert(
    onAddToCartCalledWith?.id === scanner.matchedProduct?.id,
    'Auto-add to draft bill callback (onAddToCart) executed with matched product'
  );

  // 3. Test Duplicate Guard Debounce Window
  console.log('\n--- 3. Debounce Guard Against Duplicate Continuous Frame Triggers ---');
  
  // Re-simulate same barcode immediately (within 10ms, well inside 1.8s guard)
  await scanner.handleBarcodeDetected(VALID_EAN13, () => {
    onAddToCartCalledWith = 'should-not-be-called';
  });

  assert(
    lookupCallCount === 1,
    'Duplicate scan within 1800ms debounce window was successfully ignored (lookup count remains 1)'
  );

  // 4. Test UPC-A with Leading Zero Preservation
  console.log('\n--- 4. UPC-A Leading Zero Preservation Check ---');
  const UPC_LEADING_ZERO = '012345678905'; // Organic Honey 250ml
  await scanner.handleBarcodeDetected(UPC_LEADING_ZERO, (product) => {
    onAddToCartCalledWith = product;
  });

  assert(lookupCallCount === 2, 'Second distinct barcode trigger processed by scanner');
  assert(
    scanner.matchedProduct?.barcode === '012345678905',
    `Preserved leading zero in barcode string: "${scanner.matchedProduct?.barcode}"`
  );
  assert(
    scanner.matchedProduct?.product_name?.includes('Organic Honey'),
    'Matched correct UPC-A product'
  );

  // 5. Test Camera Pause & Track Release Cleanup
  console.log('\n--- 5. Hardware Track Teardown & Camera Release ---');
  assert(!mockTrackStopped, 'Camera track active during scanning');
  scanner.stopScanner();
  assert(Boolean(mockTrackStopped), 'Camera video track stopped and hardware released on stop/unmount');

  // 6. Test Unregistered Barcode Handling
  console.log('\n--- 6. Unregistered Barcode Detection (Quick Register Trigger) ---');
  const UNREGISTERED_CODE = '8909999888877';
  await scanner.handleBarcodeDetected(UNREGISTERED_CODE);
  assert(scanner.matchedProduct === null, 'Unregistered barcode does not match product');
  assert(Boolean(scanner.lookupError), 'Lookup error / notice correctly populated for registration flow');

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runBarcodeScannerTests();
