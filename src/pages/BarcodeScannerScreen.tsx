/**
 * ClearBill AI - Universal High-Performance Barcode Scanner
 *
 * Implements:
 * 1. Automatic Barcode Detection (EAN-13, EAN-8, UPC-A, UPC-E, Code 128)
 * 2. Search MySQL Product Catalogue First
 * 3. Automatically Identify Unknown Products (via Open Food Facts API & Global Registry)
 * 4. Automatic First-Time Registration with Retailer Selling Price Confirmation
 * 5. Manual Registration Fallback for Unidentified Barcodes (with pre-filled barcode)
 * 6. Concurrency & Duplicate Guards
 * 7. Real-time Telemetry (Decode Time, DB Lookup Time, Cycle Time)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
} from '@zxing/library';
import {
  Camera,
  AlertCircle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  SwitchCamera,
  Volume2,
  ScanLine,
  FileQuestion,
  Sparkles,
  X,
  Package,
  Gauge,
  Tag,
  ShieldCheck,
  Globe,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { Product } from '../types.ts';
import { getAuthHeaders } from '../utils/authHeaders.ts';

interface BarcodeScannerScreenProps {
  onAddToCart?: (product: Product) => void;
  onNavigateToBilling?: () => void;
}

interface PerformanceMetrics {
  cameraInitMs: number;
  engine: 'Native GPU (BarcodeDetector)' | 'Optimized ZXing Engine';
  lastDecodeMs: number;
  lastLookupMs: number;
  totalCycleMs: number;
}

interface ExternalProductMeta {
  barcode: string;
  product_name: string;
  brand?: string;
  category: string;
  unit: string;
  package_size?: string;
  manufacturer?: string;
}

interface AtomicScanState {
  scannedBarcode: string | null;
  matchedProduct: Product | null;
  externalIdentified: ExternalProductMeta | null;
  lookupLoading: boolean;
  lookupError: string | null;
}

export const BarcodeScannerScreen: React.FC<BarcodeScannerScreenProps> = ({
  onAddToCart,
  onNavigateToBilling,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const nativeDetectorRef = useRef<any>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Consolidated atomic scan state
  const [scanState, setScanState] = useState<AtomicScanState>({
    scannedBarcode: null,
    matchedProduct: null,
    externalIdentified: null,
    lookupLoading: false,
    lookupError: null,
  });

  const [isScanning, setIsScanning] = useState(true);
  const [cameraError, setCameraError] = useState<{ type: string; message: string } | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [scanHistory, setScanHistory] = useState<{ barcode: string; product?: Product; timestamp: string }[]>([]);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Performance Telemetry state
  const [perfMetrics, setPerfMetrics] = useState<PerformanceMetrics>({
    cameraInitMs: 0,
    engine: 'Optimized ZXing Engine',
    lastDecodeMs: 0,
    lastLookupMs: 0,
    totalCycleMs: 0,
  });

  // Client-side instant lookup cache (0ms for repeat scans)
  const productCacheRef = useRef<Map<string, Product>>(new Map());

  // First-Time Registration Modal for Externally Identified Products
  const [confirmPriceModalOpen, setConfirmPriceModalOpen] = useState(false);
  const [confirmPrice, setConfirmPrice] = useState('');
  const [confirmTaxRate, setConfirmTaxRate] = useState('5');
  const [confirmRegisterLoading, setConfirmRegisterLoading] = useState(false);
  const [confirmRegisterError, setConfirmRegisterError] = useState<string | null>(null);

  // Manual Product Registration Modal for Unidentified Barcodes
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualCategory, setManualCategory] = useState('Groceries');
  const [manualTaxRate, setManualTaxRate] = useState('5');
  const [manualUnit, setManualUnit] = useState('pcs');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Throttling and in-flight processing locks
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);

  // Frame processing constants
  const DUPLICATE_GUARD_MS = 900; // 900ms guard allows rapid cashier workflow

  // Play synthesized Web Audio beep on successful decode (<1ms)
  const playBeep = () => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const audioCtx = new AudioCtxClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, audioCtx.currentTime); // Crisp A6 tone
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } catch {}
  };

  // Perform backend / cache product lookup with universal resolution
  const handleBarcodeDetected = useCallback(
    async (rawBarcode: string, decodeElapsedMs = 10) => {
      const cleanBarcode = rawBarcode.trim();
      if (!cleanBarcode) return;

      const now = Date.now();
      // Guard against identical barcode triggers from adjacent video frames
      if (
        lastScannedCodeRef.current === cleanBarcode &&
        now - lastScanTimeRef.current < DUPLICATE_GUARD_MS
      ) {
        return;
      }

      if (isProcessingRef.current) {
        return;
      }

      isProcessingRef.current = true;
      lastScannedCodeRef.current = cleanBarcode;
      lastScanTimeRef.current = now;

      playBeep();

      // Set initial loading state
      setScanState(prev => ({
        ...prev,
        scannedBarcode: cleanBarcode,
        matchedProduct: null,
        externalIdentified: null,
        lookupLoading: true,
        lookupError: null,
      }));

      const lookupStartTime = performance.now();

      // Check client-side instant in-memory cache (0ms resolution)
      if (productCacheRef.current.has(cleanBarcode)) {
        const cached = productCacheRef.current.get(cleanBarcode)!;
        const lookupElapsedMs = Math.round(performance.now() - lookupStartTime);
        const totalMs = Math.round(decodeElapsedMs + lookupElapsedMs);

        setScanState({
          scannedBarcode: cleanBarcode,
          matchedProduct: cached,
          externalIdentified: null,
          lookupLoading: false,
          lookupError: null,
        });

        setPerfMetrics(prev => ({
          ...prev,
          lastDecodeMs: decodeElapsedMs,
          lastLookupMs: lookupElapsedMs,
          totalCycleMs: totalMs,
        }));

        setScanHistory(prev => [
          { barcode: cleanBarcode, product: cached, timestamp: new Date().toLocaleTimeString() },
          ...prev.slice(0, 9),
        ]);

        if (onAddToCart) {
          onAddToCart(cached);
        }

        isProcessingRef.current = false;
        return;
      }

      // Universal Server-side Lookup (MySQL first, then External Product Database)
      try {
        const res = await fetch(`/api/products/lookup/${encodeURIComponent(cleanBarcode)}`, {
          headers: getAuthHeaders('retailer'),
        });
        const data = await res.json();
        const lookupElapsedMs = Math.round(performance.now() - lookupStartTime);
        const totalMs = Math.round(decodeElapsedMs + lookupElapsedMs);

        // CASE 1: Found in MySQL store catalogue
        if (res.ok && data.found && data.product) {
          productCacheRef.current.set(cleanBarcode, data.product);

          setScanState({
            scannedBarcode: cleanBarcode,
            matchedProduct: data.product,
            externalIdentified: null,
            lookupLoading: false,
            lookupError: null,
          });

          setScanHistory(prev => [
            { barcode: cleanBarcode, product: data.product, timestamp: new Date().toLocaleTimeString() },
            ...prev.slice(0, 9),
          ]);

          if (onAddToCart) {
            onAddToCart(data.product);
          }
        }
        // CASE 2: Not in MySQL, but identified from External Product Database
        else if (data.externalFound && data.externalProduct) {
          setScanState({
            scannedBarcode: cleanBarcode,
            matchedProduct: null,
            externalIdentified: data.externalProduct,
            lookupLoading: false,
            lookupError: null,
          });

          // Pre-fill price confirmation modal
          setConfirmPrice('');
          setConfirmTaxRate('5');
          setConfirmRegisterError(null);
          setConfirmPriceModalOpen(true);
        }
        // CASE 3: Not found in MySQL and not found in External Database
        else {
          setScanState({
            scannedBarcode: cleanBarcode,
            matchedProduct: null,
            externalIdentified: null,
            lookupLoading: false,
            lookupError: data.message || 'Product information not found in store catalogue or external database.',
          });

          setScanHistory(prev => [
            { barcode: cleanBarcode, timestamp: new Date().toLocaleTimeString() },
            ...prev.slice(0, 9),
          ]);
        }

        setPerfMetrics(prev => ({
          ...prev,
          lastDecodeMs: decodeElapsedMs,
          lastLookupMs: lookupElapsedMs,
          totalCycleMs: totalMs,
        }));
      } catch (err: any) {
        setScanState(prev => ({
          ...prev,
          lookupLoading: false,
          lookupError: 'Lookup error: ' + err.message,
        }));
      } finally {
        isProcessingRef.current = false;
      }
    },
    [onAddToCart]
  );

  // Handle price confirmation and automatic first-time registration for externally identified product
  const handleConfirmPriceAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const external = scanState.externalIdentified;
    if (!external) return;

    const price = parseFloat(confirmPrice);
    if (isNaN(price) || price <= 0) {
      setConfirmRegisterError('Please enter a valid retailer selling price greater than ₹0.');
      return;
    }

    setConfirmRegisterLoading(true);
    setConfirmRegisterError(null);

    try {
      const res = await fetch('/api/products/register-scanned', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders('retailer'),
        },
        body: JSON.stringify({
          barcode: external.barcode,
          product_name: external.product_name,
          category: external.category || 'General',
          unit: external.unit || 'pcs',
          unit_price: price,
          tax_rate: parseFloat(confirmTaxRate) || 5,
        }),
      });

      const data = await res.json();
      if (res.ok && data.product) {
        // Cache the newly registered product
        productCacheRef.current.set(external.barcode, data.product);

        setScanState({
          scannedBarcode: external.barcode,
          matchedProduct: data.product,
          externalIdentified: null,
          lookupLoading: false,
          lookupError: null,
        });

        setConfirmPriceModalOpen(false);

        // Add to active cart immediately
        if (onAddToCart) {
          onAddToCart(data.product);
        }

        setScanHistory(prev => [
          { barcode: external.barcode, product: data.product, timestamp: new Date().toLocaleTimeString() },
          ...prev.slice(0, 9),
        ]);
      } else {
        setConfirmRegisterError(data.error || 'Failed to register product.');
      }
    } catch (err: any) {
      setConfirmRegisterError(err.message || 'Network error registering product.');
    } finally {
      setConfirmRegisterLoading(false);
    }
  };

  // Handle manual product registration when barcode is unknown anywhere
  const handleManualRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualBarcode.trim()) {
      setManualError('Product name and barcode are required.');
      return;
    }

    const price = parseFloat(manualPrice);
    if (isNaN(price) || price <= 0) {
      setManualError('Please enter a valid selling price greater than ₹0.');
      return;
    }

    setManualLoading(true);
    setManualError(null);

    try {
      const res = await fetch('/api/products/register-scanned', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders('retailer'),
        },
        body: JSON.stringify({
          barcode: manualBarcode.trim(),
          product_name: manualName.trim(),
          category: manualCategory,
          unit: manualUnit,
          unit_price: price,
          tax_rate: parseFloat(manualTaxRate) || 5,
        }),
      });

      const data = await res.json();
      if (res.ok && data.product) {
        productCacheRef.current.set(manualBarcode.trim(), data.product);

        setScanState({
          scannedBarcode: manualBarcode.trim(),
          matchedProduct: data.product,
          externalIdentified: null,
          lookupLoading: false,
          lookupError: null,
        });

        setManualModalOpen(false);

        // Add to active cart immediately without re-scanning
        if (onAddToCart) {
          onAddToCart(data.product);
        }

        setScanHistory(prev => [
          { barcode: manualBarcode.trim(), product: data.product, timestamp: new Date().toLocaleTimeString() },
          ...prev.slice(0, 9),
        ]);
      } else {
        setManualError(data.error || 'Failed to register product.');
      }
    } catch (err: any) {
      setManualError(err.message || 'Network error registering product.');
    } finally {
      setManualLoading(false);
    }
  };

  // Initialize Native BarcodeDetector if available
  const initBarcodeDetector = () => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'];
        nativeDetectorRef.current = new (window as any).BarcodeDetector({ formats });
        setPerfMetrics(prev => ({ ...prev, engine: 'Native GPU (BarcodeDetector)' }));
        return true;
      } catch (err) {
        console.info('[Scanner] BarcodeDetector fallback to ZXing:', err);
      }
    }
    return false;
  };

  // Decode frame via ZXing without internal setInterval churn
  const decodeFrameZXing = (video: HTMLVideoElement): string | null => {
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }

    const canvas = offscreenCanvasRef.current;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);

    try {
      const luminanceSource = new RGBLuminanceSource(imageData.data, width, height);
      const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));

      if (codeReaderRef.current) {
        const result = (codeReaderRef.current as any).decodeBitmap(binaryBitmap);
        if (result && result.getText()) {
          return result.getText();
        }
      }
    } catch {
      // Normal frame without barcode
    }
    return null;
  };

  // Main unified frame processing loop
  const processVideoFrame = useCallback(
    async (timestamp: number) => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.paused) {
        animFrameIdRef.current = requestAnimationFrame(processVideoFrame);
        return;
      }

      if (isProcessingRef.current) {
        animFrameIdRef.current = requestAnimationFrame(processVideoFrame);
        return;
      }

      const decodeStart = performance.now();

      // 1. Native GPU BarcodeDetector
      if (nativeDetectorRef.current) {
        try {
          const barcodes = await nativeDetectorRef.current.detect(video);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            const decodeElapsedMs = Math.round(performance.now() - decodeStart);
            handleBarcodeDetected(barcodes[0].rawValue, decodeElapsedMs);
          }
        } catch {
          // Fallback to ZXing
        }
      } else {
        // 2. High-performance ZXing
        const detected = decodeFrameZXing(video);
        if (detected) {
          const decodeElapsedMs = Math.round(performance.now() - decodeStart);
          handleBarcodeDetected(detected, decodeElapsedMs);
        }
      }

      animFrameIdRef.current = requestAnimationFrame(processVideoFrame);
    },
    [handleBarcodeDetected]
  );

  // Stop camera tracks cleanly
  const stopCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  // Start camera stream
  const startCamera = async (deviceId?: string) => {
    const initStart = performance.now();
    setCameraError(null);
    stopCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const cameraInitMs = Math.round(performance.now() - initStart);
        setPerfMetrics(prev => ({ ...prev, cameraInitMs }));
        setIsScanning(true);

        // List cameras
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setAvailableDevices(videoDevices);
        if (!selectedDeviceId && videoDevices.length > 0) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }

        initBarcodeDetector();

        // Initialize ZXing reader
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        codeReaderRef.current = new BrowserMultiFormatReader(hints, 80);

        animFrameIdRef.current = requestAnimationFrame(processVideoFrame);
      }
    } catch (err: any) {
      console.warn('[Camera Init Notice]', err);
      setCameraError({
        type: err.name === 'NotAllowedError' ? 'PERMISSION_DENIED' : 'UNAVAILABLE',
        message:
          err.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access in browser settings.'
            : err.message || 'Camera is in use by another application or unavailable.',
      });
      setIsScanning(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const handleSwitchCamera = () => {
    if (availableDevices.length <= 1) return;
    const currentIndex = availableDevices.findIndex(d => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % availableDevices.length;
    const nextDevice = availableDevices[nextIndex];
    setSelectedDeviceId(nextDevice.deviceId);
    startCamera(nextDevice.deviceId);
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleBarcodeDetected(manualInput.trim(), 1);
      setManualInput('');
    }
  };

  const { scannedBarcode, matchedProduct, externalIdentified, lookupLoading, lookupError } = scanState;

  return (
    <div className="space-y-6">
      {/* Top Banner / Controls */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#172B4D] flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#16A34A]" />
            Universal Barcode Scanner & Product Lookup
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Auto-detects EAN-13, EAN-8, UPC-A, UPC-E, Code 128. Instant MySQL lookup with global catalog identification.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {availableDevices.length > 1 && (
            <button
              onClick={handleSwitchCamera}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <SwitchCamera className="w-3.5 h-3.5" />
              <span>Switch Camera</span>
            </button>
          )}

          {isScanning ? (
            <button
              onClick={stopCamera}
              className="px-3.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Pause Camera
            </button>
          ) : (
            <button
              onClick={() => startCamera(selectedDeviceId)}
              className="px-3.5 py-1.5 bg-[#16A34A] text-white hover:bg-[#15803D] text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Resume Camera</span>
            </button>
          )}

          {onNavigateToBilling && (
            <button
              onClick={onNavigateToBilling}
              className="px-3.5 py-1.5 bg-[#172B4D] text-white hover:bg-[#203a66] text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>View Current Bill</span>
            </button>
          )}
        </div>
      </div>

      {/* Latency & Hardware Optimization Telemetry Bar */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-[#16A34A]" />
          <span className="font-bold text-emerald-900">Scanner Engine:</span>
          <span className="bg-white border border-emerald-300 text-emerald-800 font-semibold px-2 py-0.5 rounded text-[11px]">
            {perfMetrics.engine}
          </span>
        </div>

        <div className="flex items-center gap-4 text-emerald-950 font-mono text-[11px]">
          <div>
            <span className="text-emerald-700 font-sans">Camera: </span>
            <span className="font-bold">{perfMetrics.cameraInitMs}ms</span>
          </div>
          <div>
            <span className="text-emerald-700 font-sans">Decode: </span>
            <span className="font-bold">{perfMetrics.lastDecodeMs}ms</span>
          </div>
          <div>
            <span className="text-emerald-700 font-sans">Lookup: </span>
            <span className="font-bold">{perfMetrics.lastLookupMs}ms</span>
          </div>
          <div className="bg-[#16A34A] text-white px-2 py-0.5 rounded font-sans font-bold">
            Total Cycle: {perfMetrics.totalCycleMs}ms
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Video Camera Viewport */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs relative">
            <div className="relative w-full h-[360px] md:h-[420px] bg-slate-900 flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />

              {/* Viewfinder Target Reticle */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                <div
                  className={`relative w-64 md:w-80 h-44 rounded-xl border-2 transition-colors duration-300 ${
                    scannedBarcode && !lookupError
                      ? 'border-[#16A34A] shadow-[0_0_20px_rgba(22,163,74,0.4)]'
                      : 'border-white/70'
                  }`}
                >
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-[#16A34A] rounded-tl" />
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-[#16A34A] rounded-tr" />
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-[#16A34A] rounded-bl" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-[#16A34A] rounded-br" />

                  {/* Horizontal Red Laser Line */}
                  <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />

                  <div className="absolute bottom-2 left-0 right-0 text-center">
                    <span className="text-[11px] font-medium text-white/90 bg-black/60 px-2 py-0.5 rounded">
                      Align any retail barcode within frame
                    </span>
                  </div>
                </div>
              </div>

              {/* Camera Error Banner */}
              {cameraError && (
                <div className="absolute inset-0 bg-slate-900/90 text-white p-6 flex flex-col items-center justify-center text-center">
                  <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
                  <h4 className="text-base font-bold mb-1">
                    {cameraError.type === 'PERMISSION_DENIED' ? 'Camera Permission Required' : 'Camera Unavailable'}
                  </h4>
                  <p className="text-xs text-slate-300 max-w-md mb-4">{cameraError.message}</p>
                  <button
                    onClick={() => startCamera(selectedDeviceId)}
                    className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
                  >
                    Retry Camera Connection
                  </button>
                </div>
              )}
            </div>

            {/* Live Status Bar */}
            <div className="p-3 bg-slate-50 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                <span>{isScanning ? 'Continuous Barcode Scanner Active' : 'Scanner Paused'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5 text-[#16A34A]" />
                <span className="text-[11px] text-slate-500">Audio Chime: ON</span>
              </div>
            </div>
          </div>

          {/* Manual Barcode Input Fallback */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
              Manual Barcode Fallback
            </h3>
            <form onSubmit={handleManualSearch} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter EAN-13, EAN-8, UPC or SKU (e.g. 8901058852332)"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                className="flex-1 bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#16A34A]"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#172B4D] hover:bg-[#203a66] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Lookup</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Scan Result Card & Test Barcodes */}
        <div className="lg:col-span-5 space-y-4">
          {/* Active Result Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[#172B4D] mb-3 flex items-center justify-between">
              <span>Detection Result</span>
              {scannedBarcode && (
                <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                  {scannedBarcode}
                </span>
              )}
            </h3>

            {lookupLoading ? (
              <div className="py-8 text-center text-slate-500 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#16A34A]" />
                <p className="text-xs">Searching store catalogue and global product registry...</p>
              </div>
            ) : matchedProduct ? (
              /* CASE 1: Registered Product Match */
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                      Product Verified & Added to Bill
                    </span>
                    <h4 className="text-base font-bold text-slate-900 leading-snug">
                      {matchedProduct.product_name}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Category: {matchedProduct.category} · Unit: {matchedProduct.unit}
                    </p>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-[#16A34A] shrink-0" />
                </div>

                <div className="pt-2 border-t border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500">Retail Selling Price:</span>
                    <p className="text-lg font-bold text-slate-900 tabular-nums">
                      ₹{matchedProduct.unit_price.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500">Tax Rate:</span>
                    <p className="text-sm font-semibold text-slate-700 tabular-nums">
                      {matchedProduct.tax_rate}%
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={() => onAddToCart && onAddToCart(matchedProduct)}
                    className="flex-1 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Increment Quantity (+1)</span>
                  </button>
                  {onNavigateToBilling && (
                    <button
                      onClick={onNavigateToBilling}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      View Bill
                    </button>
                  )}
                </div>
              </div>
            ) : externalIdentified ? (
              /* CASE 2: Unknown in Store, but Identified Externally */
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                <div className="flex items-start gap-2.5">
                  <Globe className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
                      Product Identified in Global Registry
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      {externalIdentified.product_name}
                    </h4>
                    <p className="text-xs text-slate-600">
                      Brand: {externalIdentified.brand || 'Retail Brand'} · Category: {externalIdentified.category}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white border border-blue-200 rounded-lg text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-blue-900">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>First-Time Product Registration Required</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Product identity verified. Enter your store's selling price to save it to your MySQL catalogue and add it to the bill.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setConfirmPrice('');
                    setConfirmTaxRate('5');
                    setConfirmRegisterError(null);
                    setConfirmPriceModalOpen(true);
                  }}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Set Selling Price & Register</span>
                </button>
              </div>
            ) : lookupError ? (
              /* CASE 3: Not Found Anywhere */
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                <div className="flex items-start gap-2.5">
                  <FileQuestion className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">Product Not Found</h4>
                    <p className="text-xs text-amber-800 mt-1">{lookupError}</p>
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setManualBarcode(scannedBarcode || '');
                      setManualName('');
                      setManualPrice('');
                      setManualError(null);
                      setManualModalOpen(true);
                    }}
                    className="w-full py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-lg transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Product Manually (Pre-filled Barcode)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-slate-400 space-y-2">
                <ScanLine className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs">Hold any physical product barcode in front of the camera.</p>
                <p className="text-[11px] text-slate-400">
                  Known items are added to the bill instantly; unknown items are identified and registered on first scan.
                </p>
              </div>
            )}
          </div>

          {/* Quick Real Barcode Test Samples */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs space-y-2.5">
            <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Universal Barcode Test Samples:</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => handleBarcodeDetected('8901030383786', 5)}
                className="p-2 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 text-left transition-colors cursor-pointer"
              >
                <span className="block font-bold text-slate-800 text-[11px]">Tata Tea Gold (EAN-13)</span>
                <span className="text-[10px] text-slate-500 font-mono">8901030383786 · In MySQL</span>
              </button>

              <button
                onClick={() => handleBarcodeDetected('8901058852332', 5)}
                className="p-2 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-left transition-colors cursor-pointer"
              >
                <span className="block font-bold text-slate-800 text-[11px]">Maggi Noodles (EAN-13)</span>
                <span className="text-[10px] text-blue-600 font-mono">8901058852332 · External</span>
              </button>

              <button
                onClick={() => handleBarcodeDetected('8901719101050', 5)}
                className="p-2 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-left transition-colors cursor-pointer"
              >
                <span className="block font-bold text-slate-800 text-[11px]">Parle-G Biscuits (EAN-13)</span>
                <span className="text-[10px] text-blue-600 font-mono">8901719101050 · External</span>
              </button>

              <button
                onClick={() => handleBarcodeDetected('8909999999999', 5)}
                className="p-2 rounded-lg border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 text-left transition-colors cursor-pointer"
              >
                <span className="block font-bold text-slate-800 text-[11px]">Unregistered Barcode</span>
                <span className="text-[10px] text-amber-700 font-mono">8909999999999 · Manual</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: CONFIRM SELLING PRICE FOR EXTERNALLY IDENTIFIED PRODUCT     */}
      {/* ===================================================================== */}
      {confirmPriceModalOpen && externalIdentified && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#172B4D]">Register Identified Product</h3>
                  <p className="text-[11px] text-slate-500 font-mono">Barcode: {externalIdentified.barcode}</p>
                </div>
              </div>
              <button
                onClick={() => setConfirmPriceModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Verified External Details */}
            <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-700">
              <div>
                <span className="text-slate-400 block text-[10px]">Product Name</span>
                <span className="font-bold text-slate-900 text-sm">{externalIdentified.product_name}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Brand: <strong>{externalIdentified.brand || 'Standard Brand'}</strong></span>
                <span>Category: <strong>{externalIdentified.category}</strong></span>
              </div>
            </div>

            {confirmRegisterError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                {confirmRegisterError}
              </div>
            )}

            {/* Price Form */}
            <form onSubmit={handleConfirmPriceAndRegister} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Retailer Selling Price (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Enter selling price"
                  value={confirmPrice}
                  onChange={e => setConfirmPrice(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-base font-bold text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  autoFocus
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Product identity was verified. Enter your outlet's selling price to complete registration.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Applicable GST Rate (%)
                </label>
                <select
                  value={confirmTaxRate}
                  onChange={e => setConfirmTaxRate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#16A34A]"
                >
                  <option value="0">0% (Exempt)</option>
                  <option value="5">5% (Standard Groceries)</option>
                  <option value="12">12% (Processed Goods)</option>
                  <option value="18">18% (Consumer Goods)</option>
                  <option value="28">28% (Luxury)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmPriceModalOpen(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={confirmRegisterLoading}
                  className="flex-1 py-2 bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 text-white font-bold rounded-lg shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {confirmRegisterLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Confirm & Add to Bill</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: MANUAL REGISTRATION FOR UNIDENTIFIED BARCODES                */}
      {/* ===================================================================== */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#16A34A] flex items-center justify-center font-bold">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#172B4D]">Manual Product Registration</h3>
                  <p className="text-[11px] text-slate-500">Save to MySQL catalogue and add to bill</p>
                </div>
              </div>
              <button
                onClick={() => setManualModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {manualError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                {manualError}
              </div>
            )}

            <form onSubmit={handleManualRegister} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Scanned Barcode <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualBarcode}
                  onChange={e => setManualBarcode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-mono text-slate-800 focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fresh Mango 1kg"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:border-[#16A34A]"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Selling Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={manualPrice}
                    onChange={e => setManualPrice(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-900 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    GST Rate (%)
                  </label>
                  <select
                    value={manualTaxRate}
                    onChange={e => setManualTaxRate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:border-[#16A34A]"
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={manualCategory}
                    onChange={e => setManualCategory(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit</label>
                  <input
                    type="text"
                    value={manualUnit}
                    onChange={e => setManualUnit(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:border-[#16A34A]"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setManualModalOpen(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualLoading}
                  className="flex-1 py-2 bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 text-white font-bold rounded-lg shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {manualLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Save & Add to Bill</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
