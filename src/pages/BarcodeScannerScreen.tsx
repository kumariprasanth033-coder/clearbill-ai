/**
 * ClearBill AI - High-Performance Physical Camera Barcode Scanner
 *
 * Performance Optimizations:
 * 1. Unified requestAnimationFrame Loop:
 *    - Replaces uncontrolled setInterval callbacks with a single requestAnimationFrame loop.
 *    - Unifies both Native GPU BarcodeDetector and fallback ZXing engine under one RAF runner.
 * 2. Throttled Camera Stream Processing:
 *    - Throttles frame sampling to ~15 FPS (66ms cadence) to prevent CPU/GPU thread saturation.
 *    - Automatically throttles down to 250ms while a product lookup is in flight.
 *    - Pauses redundant frame decoding during network roundtrips to improve frame-to-lookup response time.
 * 3. Batched Atomic State Updates (Anti-Jank):
 *    - Replaces continuous individual React state updates with a consolidated atomic scan state.
 *    - Zero unnecessary component re-renders during video panning/aiming.
 * 4. Zero-Latency In-Memory LRU Cache:
 *    - Resolves repeated barcodes in 0ms without server roundtrips.
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
} from 'lucide-react';
import { Product } from '../types.ts';

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

// Consolidated atomic scan state to eliminate continuous re-render churn
interface AtomicScanState {
  scannedBarcode: string | null;
  matchedProduct: Product | null;
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

  // Consolidated atomic scan state (single re-render per result)
  const [scanState, setScanState] = useState<AtomicScanState>({
    scannedBarcode: null,
    matchedProduct: null,
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

  // Quick Register Product Modal state for unknown barcodes
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [regBarcode, setRegBarcode] = useState('');
  const [regName, setRegName] = useState('');
  const [regPrice, setRegPrice] = useState('');
  const [regCategory, setRegCategory] = useState('Groceries');
  const [regTaxRate, setRegTaxRate] = useState('5');
  const [regLoading, setRegLoading] = useState(false);

  // Throttling and in-flight processing locks (Refs prevent re-rendering during frame loop)
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const lastFrameProcessTimeRef = useRef<number>(0);

  // Frame processing constants
  const FRAME_THROTTLE_MS = 66; // ~15 FPS optimal scanning rate
  const IN_FLIGHT_THROTTLE_MS = 250; // Throttle down when processing lookup
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
    } catch {
      // Audio optional
    }
  };

  // Perform backend / cache product lookup with batched state resolution
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
        return; // Skip duplicate frame while previous lookup is resolving
      }

      // Immediately acquire in-flight processing lock to throttle stream
      isProcessingRef.current = true;
      lastScannedCodeRef.current = cleanBarcode;
      lastScanTimeRef.current = now;

      playBeep();

      // Set initial loading state atomically
      setScanState(prev => ({
        ...prev,
        scannedBarcode: cleanBarcode,
        lookupLoading: true,
        lookupError: null,
      }));

      const lookupStartTime = performance.now();

      // Check client-side instant in-memory cache (0ms resolution)
      if (productCacheRef.current.has(cleanBarcode)) {
        const cached = productCacheRef.current.get(cleanBarcode)!;
        const lookupElapsedMs = Math.round(performance.now() - lookupStartTime);
        const totalMs = Math.round(decodeElapsedMs + lookupElapsedMs);

        // Batched single state update
        setScanState({
          scannedBarcode: cleanBarcode,
          matchedProduct: cached,
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

      try {
        const res = await fetch(`/api/products/lookup/${encodeURIComponent(cleanBarcode)}`);
        const data = await res.json();
        const lookupElapsedMs = Math.round(performance.now() - lookupStartTime);
        const totalMs = Math.round(decodeElapsedMs + lookupElapsedMs);

        if (res.ok && data.found && data.product) {
          // Cache for instant repeat scans
          productCacheRef.current.set(cleanBarcode, data.product);

          // Batched atomic update on match
          setScanState({
            scannedBarcode: cleanBarcode,
            matchedProduct: data.product,
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
        } else {
          // Batched atomic update on product not found
          setScanState({
            scannedBarcode: cleanBarcode,
            matchedProduct: null,
            lookupLoading: false,
            lookupError: data.message || 'Barcode detected, but this product is not registered in your store catalogue.',
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
          lookupError: 'Network or database connection failure: ' + err.message,
        }));
      } finally {
        isProcessingRef.current = false;
      }
    },
    [onAddToCart]
  );

  // Initialize Native BarcodeDetector if available in browser
  const initBarcodeDetector = () => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'];
        nativeDetectorRef.current = new (window as any).BarcodeDetector({ formats });
        setPerfMetrics(prev => ({ ...prev, engine: 'Native GPU (BarcodeDetector)' }));
        return true;
      } catch (err) {
        console.info('[Scanner] Native BarcodeDetector initialization fallback to ZXing:', err);
      }
    }
    return false;
  };

  // Helper to decode frame via ZXing without internal setInterval churn
  const decodeFrameZXing = (video: HTMLVideoElement): string | null => {
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }

    const canvas = offscreenCanvasRef.current;
    const vWidth = video.videoWidth || 640;
    const vHeight = video.videoHeight || 480;

    // Center crop 70% width, 50% height for 3x faster binarization
    const cropWidth = Math.floor(vWidth * 0.7);
    const cropHeight = Math.floor(vHeight * 0.5);
    const cropX = Math.floor((vWidth - cropWidth) / 2);
    const cropY = Math.floor((vHeight - cropHeight) / 2);

    if (canvas.width !== cropWidth || canvas.height !== cropHeight) {
      canvas.width = cropWidth;
      canvas.height = cropHeight;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    const imgData = ctx.getImageData(0, 0, cropWidth, cropHeight);

    try {
      if (!codeReaderRef.current) {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
        ]);
        codeReaderRef.current = new BrowserMultiFormatReader(hints);
      }

      const luminanceSource = new RGBLuminanceSource(imgData.data, cropWidth, cropHeight);
      const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
      const result = codeReaderRef.current.decodeBitmap(binaryBitmap);
      return result ? result.getText() : null;
    } catch {
      return null; // Frame miss is normal during panning
    }
  };

  // Unified requestAnimationFrame Loop with Camera Stream Throttling
  const runCameraProcessingLoop = useCallback(() => {
    if (!videoRef.current || !isScanning) return;

    const video = videoRef.current;

    // Check video readiness
    if (video.readyState >= 2 && !video.paused) {
      const now = performance.now();
      // Throttle interval adapts: 66ms normally, 250ms when lookup is in-flight
      const activeThrottle = isProcessingRef.current ? IN_FLIGHT_THROTTLE_MS : FRAME_THROTTLE_MS;

      if (now - lastFrameProcessTimeRef.current >= activeThrottle) {
        lastFrameProcessTimeRef.current = now;

        if (!isProcessingRef.current) {
          const decodeStart = performance.now();

          // 1. Primary: Native GPU BarcodeDetector
          if (nativeDetectorRef.current) {
            nativeDetectorRef.current
              .detect(video)
              .then((barcodes: any[]) => {
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  const decodeMs = Math.round(performance.now() - decodeStart);
                  handleBarcodeDetected(barcodes[0].rawValue, decodeMs);
                }
              })
              .catch(() => {});
          } else {
            // 2. Fallback: Optimized Throttled ZXing Frame Binarizer
            const detectedCode = decodeFrameZXing(video);
            if (detectedCode) {
              const decodeMs = Math.round(performance.now() - decodeStart);
              handleBarcodeDetected(detectedCode, decodeMs);
            }
          }
        }
      }
    }

    // Schedule next frame in animation loop
    animFrameIdRef.current = requestAnimationFrame(runCameraProcessingLoop);
  }, [handleBarcodeDetected, isScanning]);

  // Start Camera with optimal resolution and rear-camera priority
  const startCamera = async (deviceId?: string) => {
    setCameraError(null);
    const cameraStartTime = performance.now();

    try {
      stopCamera();

      // Optimal 720p constraints avoid 4K bandwidth overhead
      const videoConstraints: MediaTrackConstraints = {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
      };

      if (deviceId) {
        (videoConstraints as any).deviceId = { exact: deviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const cameraReadyMs = Math.round(performance.now() - cameraStartTime);
        setPerfMetrics(prev => ({ ...prev, cameraInitMs: cameraReadyMs }));
        setIsScanning(true);

        // Check for native GPU BarcodeDetector first
        initBarcodeDetector();

        // Start unified requestAnimationFrame processing loop
        animFrameIdRef.current = requestAnimationFrame(runCameraProcessingLoop);
      }

      // Query devices for camera switch list (async in background)
      if (navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices().then(devices => {
          const videoDevs = devices.filter(d => d.kind === 'videoinput');
          setAvailableDevices(videoDevs);
          if (deviceId) {
            setSelectedDeviceId(deviceId);
          } else if (videoDevs.length > 0) {
            const backCam = videoDevs.find(d =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
            );
            setSelectedDeviceId(backCam ? backCam.deviceId : videoDevs[0].deviceId);
          }
        });
      }
    } catch (err: any) {
      console.error('[Scanner Init Error]', err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        setCameraError({
          type: 'PERMISSION_DENIED',
          message: 'Camera permission denied. Please allow camera access in your browser to scan physical barcodes.',
        });
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError({
          type: 'UNAVAILABLE',
          message: 'No physical camera hardware detected on this device.',
        });
      } else {
        setCameraError({
          type: 'GENERAL_ERROR',
          message: 'Camera initialization failed: ' + (err.message || 'Unknown error'),
        });
      }
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
      } catch {}
      codeReaderRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {}
      });
      mediaStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
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

  const handleQuickRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regBarcode.trim()) return;
    setRegLoading(true);

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: regName.trim(),
          barcode: regBarcode.trim(),
          category: regCategory,
          unit_price: parseFloat(regPrice) || 0,
          tax_rate: parseFloat(regTaxRate) || 0,
          unit: 'pcs',
        }),
      });

      const data = await res.json();
      if (res.ok && data.id) {
        // Cache the newly registered product
        productCacheRef.current.set(regBarcode.trim(), data);
        setScanState({
          scannedBarcode: regBarcode.trim(),
          matchedProduct: data,
          lookupLoading: false,
          lookupError: null,
        });
        setRegModalOpen(false);
        setRegName('');
        setRegPrice('');
        if (onAddToCart) {
          onAddToCart(data);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRegLoading(false);
    }
  };

  const { scannedBarcode, matchedProduct, lookupLoading, lookupError } = scanState;

  return (
    <div className="space-y-6">
      {/* Top Banner / Controls */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#172B4D] flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#16A34A]" />
            Continuous Retail Barcode Scanner
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Supported Formats: EAN-13, EAN-8, UPC-A, UPC-E, Code 128. Throttled RAF loop with zero state-churn architecture.
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
            {perfMetrics.engine} (Throttled RAF)
          </span>
        </div>

        <div className="flex items-center gap-4 text-emerald-950 font-mono text-[11px]">
          <div>
            <span className="text-emerald-700 font-sans">Camera Ready: </span>
            <span className="font-bold">{perfMetrics.cameraInitMs}ms</span>
          </div>
          <div>
            <span className="text-emerald-700 font-sans">Decode Time: </span>
            <span className="font-bold">{perfMetrics.lastDecodeMs}ms</span>
          </div>
          <div>
            <span className="text-emerald-700 font-sans">DB Lookup: </span>
            <span className="font-bold">{perfMetrics.lastLookupMs}ms</span>
          </div>
          <div className="bg-emerald-600 text-white px-2 py-0.5 rounded font-sans font-bold">
            Total Cycle: {perfMetrics.totalCycleMs}ms
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Video Camera Viewport */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs relative">
            <div className="relative w-full h-[360px] md:h-[420px] bg-slate-900 flex items-center justify-center overflow-hidden">
              {/* Video Element for live camera feed */}
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />

              {/* Scanning Target Reticle & Visual Green Detection Frame */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                <div
                  className={`relative w-64 md:w-80 h-44 rounded-xl border-2 transition-colors duration-300 ${
                    scannedBarcode && !lookupError
                      ? 'border-[#16A34A] shadow-[0_0_20px_rgba(22,163,74,0.4)]'
                      : 'border-white/70'
                  }`}
                >
                  {/* Corner Target Accents */}
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-[#16A34A] rounded-tl" />
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-[#16A34A] rounded-tr" />
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-[#16A34A] rounded-bl" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-[#16A34A] rounded-br" />

                  {/* Horizontal Aiming Laser Guide */}
                  <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />

                  <div className="absolute bottom-2 left-0 right-0 text-center">
                    <span className="text-[11px] font-medium text-white/90 bg-black/60 px-2 py-0.5 rounded">
                      Align barcode within frame
                    </span>
                  </div>
                </div>
              </div>

              {/* Camera Error Fallback Card */}
              {cameraError && (
                <div className="absolute inset-0 bg-slate-900/90 text-white p-6 flex flex-col items-center justify-center text-center">
                  <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
                  <h4 className="text-base font-bold mb-1">
                    {cameraError.type === 'PERMISSION_DENIED' ? 'Camera Permission Required' : 'Camera Unavailable'}
                  </h4>
                  <p className="text-xs text-slate-300 max-w-md mb-4">{cameraError.message}</p>
                  <p className="text-[11px] text-slate-400 mb-4">
                    Tip: Use the Manual Barcode Entry below or tap any test barcode to simulate scanning instantly.
                  </p>
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
                <span>{isScanning ? 'Continuous Throttled Scanner Active (15 FPS)' : 'Scanner Paused'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5 text-[#16A34A]" />
                <span className="text-[11px] text-slate-500">Audio Feedback: ON</span>
              </div>
            </div>
          </div>

          {/* Manual Barcode Input Fallback */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
              Manual Barcode Lookup
            </h3>
            <form onSubmit={handleManualSearch} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter EAN-13, EAN-8, UPC or SKU (e.g. 8901030383786)"
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

        {/* Right Column: Scan Result Card & Quick Test Barcodes */}
        <div className="lg:col-span-5 space-y-4">
          {/* Active Result Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[#172B4D] mb-3 flex items-center justify-between">
              <span>Latest Detection Result</span>
              {scannedBarcode && (
                <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                  {scannedBarcode}
                </span>
              )}
            </h3>

            {lookupLoading ? (
              <div className="py-8 text-center text-slate-500 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#16A34A]" />
                <p className="text-xs">Querying database for matching barcode...</p>
              </div>
            ) : matchedProduct ? (
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
                    <span className="text-xs text-slate-500">Registered Price:</span>
                    <p className="text-lg font-bold text-slate-900 tabular-nums">
                      ₹{matchedProduct.unit_price.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500">Applicable GST:</span>
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
                    <span>Add Another (+1)</span>
                  </button>
                  {onNavigateToBilling && (
                    <button
                      onClick={onNavigateToBilling}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Go to Checkout
                    </button>
                  )}
                </div>
              </div>
            ) : lookupError ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                <div className="flex items-start gap-2.5">
                  <FileQuestion className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">Product Not Found</h4>
                    <p className="text-xs text-amber-800 mt-1">{lookupError}</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setRegBarcode(scannedBarcode || '');
                      setRegModalOpen(true);
                    }}
                    className="flex-1 py-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-lg transition-colors shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Quick Register Product</span>
                  </button>
                  <button
                    onClick={() => setManualInput(scannedBarcode || '')}
                    className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Edit / Search
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-slate-400 space-y-2">
                <ScanLine className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs">Hold any physical product barcode in front of the camera.</p>
              </div>
            )}
          </div>

          {/* Known Test Barcodes (Click to simulate scan instantly) */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#16A34A]" />
                Registered Test Barcodes (In Database)
              </h3>
              <span className="text-[10px] text-slate-400">Click to Simulate Scan</span>
            </div>

            <div className="space-y-2">
              {[
                { name: 'Tata Tea Gold 250g', code: '8901030383786', format: 'EAN-13', price: '₹165.00' },
                { name: 'Amul Pure Ghee 500ml', code: '8901233024823', format: 'EAN-13', price: '₹315.00' },
                { name: 'Parle-G Gold Biscuits', code: '8901499026418', format: 'EAN-13', price: '₹120.00' },
                { name: 'ClearBill Mint Tin', code: '50123456', format: 'EAN-8', price: '₹50.00' },
                { name: 'Organic Honey (Leading 0)', code: '012345678905', format: 'UPC-A', price: '₹240.00' },
                { name: 'Stainless Flask 750ml', code: 'CB-RETAIL-1001', format: 'Code 128', price: '₹699.00' },
              ].map(item => (
                <div
                  key={item.code}
                  onClick={() => handleBarcodeDetected(item.code, 2)}
                  className="cursor-pointer p-2.5 rounded-lg border border-slate-100 hover:border-[#16A34A] hover:bg-emerald-50/40 transition-all flex items-center justify-between text-xs group"
                >
                  <div>
                    <span className="font-semibold text-slate-800 group-hover:text-[#16A34A] block">{item.name}</span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {item.format} · {item.code}
                    </span>
                  </div>
                  <span className="font-bold text-emerald-700 tabular-nums">{item.price}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Scans Session Log */}
          {scanHistory.length > 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
              <h3 className="text-xs font-semibold text-slate-700 mb-2">Session Scan History</h3>
              <div className="divide-y divide-slate-100 text-xs">
                {scanHistory.map((h, i) => (
                  <div key={i} className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-800">
                        {h.product?.product_name || 'Unregistered Barcode'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 block">{h.barcode}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{h.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Register Product Modal Dialog */}
      {regModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-[#16A34A] rounded-lg">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#172B4D]">Quick Register Product</h3>
                  <p className="text-xs text-slate-500">Add unknown barcode directly to your store catalog</p>
                </div>
              </div>
              <button
                onClick={() => setRegModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Scanned Barcode
                </label>
                <input
                  type="text"
                  value={regBarcode}
                  onChange={e => setRegBarcode(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Britannia Good Day 100g"
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={regCategory}
                    onChange={e => setRegCategory(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#16A34A]"
                  >
                    <option value="Groceries">Groceries</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Snacks">Snacks</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Personal Care">Personal Care</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GST Rate (%)
                  </label>
                  <select
                    value={regTaxRate}
                    onChange={e => setRegTaxRate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#16A34A]"
                  >
                    <option value="0">0% (Nil)</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST</option>
                    <option value="28">28% GST</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Selling Price (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={regPrice}
                  onChange={e => setRegPrice(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#16A34A]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRegModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={regLoading}
                  className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                >
                  {regLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Save & Add to Bill</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
