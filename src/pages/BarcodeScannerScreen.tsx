/**
 * ClearBill AI - Physical Camera Barcode Scanner Screen
 * Uses @zxing/library BrowserMultiFormatReader for real continuous decoding
 * Supports EAN-13, EAN-8, UPC-A, UPC-E, and Code 128 formats.
 * Preserves leading zeros, rear-camera preference, debounce guard, and live product catalog lookup.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
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
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { Product } from '../types.ts';

interface BarcodeScannerScreenProps {
  onAddToCart?: (product: Product) => void;
  onNavigateToBilling?: () => void;
}

export const BarcodeScannerScreen: React.FC<BarcodeScannerScreenProps> = ({
  onAddToCart,
  onNavigateToBilling,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // Scanner state
  const [isScanning, setIsScanning] = useState(true);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<{ type: string; message: string } | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [scanHistory, setScanHistory] = useState<{ barcode: string; product?: Product; timestamp: string }[]>([]);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Duplicate scan guard
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const DUPLICATE_GUARD_MS = 1800; // 1.8s guard against unintentional double triggers of identical barcode

  // Play synthesized Web Audio beep on successful decode
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, audioCtx.currentTime); // High clear A6 tone
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch {
      // Audio fallback
    }
  };

  // Perform backend MySQL product lookup
  const handleBarcodeDetected = async (rawBarcode: string) => {
    const cleanBarcode = rawBarcode.trim();
    if (!cleanBarcode) return;

    const now = Date.now();
    if (
      lastScannedCodeRef.current === cleanBarcode &&
      now - lastScanTimeRef.current < DUPLICATE_GUARD_MS
    ) {
      return; // Filter rapid duplicate scan of identical barcode
    }

    lastScannedCodeRef.current = cleanBarcode;
    lastScanTimeRef.current = now;

    playBeep();
    setScannedBarcode(cleanBarcode);
    setLookupLoading(true);
    setLookupError(null);

    try {
      const res = await fetch(`/api/products/lookup/${encodeURIComponent(cleanBarcode)}`);
      const data = await res.json();

      if (res.ok && data.found && data.product) {
        setMatchedProduct(data.product);
        setScanHistory(prev => [
          { barcode: cleanBarcode, product: data.product, timestamp: new Date().toLocaleTimeString() },
          ...prev.slice(0, 9),
        ]);

        // Auto-add to cart/draft bill if handler passed
        if (onAddToCart) {
          onAddToCart(data.product);
        }
      } else {
        setMatchedProduct(null);
        setLookupError(
          data.message || 'Barcode detected, but this product is not registered in your store catalogue.'
        );
        setScanHistory(prev => [
          { barcode: cleanBarcode, timestamp: new Date().toLocaleTimeString() },
          ...prev.slice(0, 9),
        ]);
      }
    } catch (err: any) {
      setLookupError('Network or database connection failure: ' + err.message);
    } finally {
      setLookupLoading(false);
    }
  };

  // Start ZXing Camera Scanner
  const startCamera = async (deviceId?: string) => {
    setCameraError(null);
    try {
      // Configure ZXing hints with standard retail barcode formats
      const hints = new Map();
      const formats = [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.QR_CODE,
      ];
      hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);

      const reader = new BrowserMultiFormatReader(hints);
      codeReaderRef.current = reader;

      // Query available video input devices
      const videoDevices = await reader.listVideoInputDevices();
      setAvailableDevices(videoDevices);

      // Prefer rear-facing camera or passed deviceId
      let targetId = deviceId;
      if (!targetId && videoDevices.length > 0) {
        const backCam = videoDevices.find(d =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        );
        targetId = backCam ? backCam.deviceId : videoDevices[videoDevices.length - 1].deviceId;
      }

      if (targetId) {
        setSelectedDeviceId(targetId);
      }

      if (videoRef.current) {
        // Continuous decoding loop without restarting video stream
        reader.decodeFromVideoDevice(
          targetId || null,
          videoRef.current,
          (result, error) => {
            if (result) {
              handleBarcodeDetected(result.getText());
            }
            if (error && !(error.name === 'NotFoundException')) {
              // Non-fatal scan frame miss is expected during frame scanning
            }
          }
        );
        setIsScanning(true);
      }
    } catch (err: any) {
      console.error('[Scanner Init Error]', err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        setCameraError({
          type: 'PERMISSION_DENIED',
          message: 'Camera permission denied. Please allow camera access in your browser settings.',
        });
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError({
          type: 'UNAVAILABLE',
          message: 'No camera hardware found on this device.',
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
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
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
    stopCamera();
    setSelectedDeviceId(nextDevice.deviceId);
    startCamera(nextDevice.deviceId);
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleBarcodeDetected(manualInput.trim());
      setManualInput('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#172B4D] flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#16A34A]" />
            Continuous Retail Barcode Scanner
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Supported Formats: EAN-13, EAN-8, UPC-A, UPC-E, Code 128. Live rear-camera decoding with MySQL product matching.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {availableDevices.length > 1 && (
            <button
              onClick={handleSwitchCamera}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              <SwitchCamera className="w-3.5 h-3.5" />
              <span>Switch Camera</span>
            </button>
          )}

          {isScanning ? (
            <button
              onClick={stopCamera}
              className="px-3.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-semibold rounded-lg transition-colors"
            >
              Pause Camera
            </button>
          ) : (
            <button
              onClick={() => startCamera(selectedDeviceId)}
              className="px-3.5 py-1.5 bg-[#16A34A] text-white hover:bg-[#15803D] text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Resume Camera</span>
            </button>
          )}

          {onNavigateToBilling && (
            <button
              onClick={onNavigateToBilling}
              className="px-3.5 py-1.5 bg-[#172033] text-white hover:bg-[#263449] text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>View Current Bill</span>
            </button>
          )}
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

                  {/* Red / Green Horizontal Laser Aiming Guide */}
                  <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />

                  <div className="absolute bottom-2 left-0 right-0 text-center">
                    <span className="text-[11px] font-medium text-white/90 bg-black/50 px-2 py-0.5 rounded">
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
                    Tip: Use the Manual Barcode Entry below or click test barcodes to test instantly.
                  </p>
                  <button
                    onClick={() => startCamera(selectedDeviceId)}
                    className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded-lg shadow-sm"
                  >
                    Retry Camera Connection
                  </button>
                </div>
              )}
            </div>

            {/* Live Status Bar */}
            <div className="p-3 bg-slate-50 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <span>{isScanning ? 'Active Continuous Scanner' : 'Scanner Paused'}</span>
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
                className="px-4 py-2 bg-[#172033] hover:bg-[#263449] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
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
                <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                  {scannedBarcode}
                </span>
              )}
            </h3>

            {lookupLoading ? (
              <div className="py-8 text-center text-slate-500 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#16A34A]" />
                <p className="text-xs">Querying MySQL database for matching barcode...</p>
              </div>
            ) : matchedProduct ? (
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
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

                <button
                  onClick={() => onAddToCart && onAddToCart(matchedProduct)}
                  className="w-full py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Another (+1) to Draft Bill</span>
                </button>
              </div>
            ) : lookupError ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                <div className="flex items-start gap-2.5">
                  <FileQuestion className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">Catalogue Notice</h4>
                    <p className="text-xs text-amber-800 mt-1">{lookupError}</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setManualInput(scannedBarcode || '')}
                    className="flex-1 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold rounded-lg transition-colors"
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

          {/* Known Test Barcodes (Click to test instantly or point camera at screen) */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#16A34A]" />
                Known Test Barcodes (In MySQL Database)
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
                  onClick={() => handleBarcodeDetected(item.code)}
                  className="cursor-pointer p-2.5 rounded-lg border border-slate-100 hover:border-[#16A34A] hover:bg-emerald-50/40 transition-all flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-800 block">{item.name}</span>
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
    </div>
  );
};
