/**
 * ClearBill AI - QR Code Parser & Scheme Validator
 * Strictly separates:
 * 1. Digital Receipt QR codes (ClearBill AI receipt URLs and guest tokens)
 * 2. UPI Payment QR codes (Standard upi://pay scheme specification)
 */

export interface ParsedReceiptQr {
  isValidReceipt: boolean;
  token?: string;
  fullUrl?: string;
  error?: string;
}

export interface ParsedUpiQr {
  isValidUpi: boolean;
  payeeVpa?: string;
  payeeName?: string;
  amount?: number;
  currency: string;
  transactionRef?: string;
  note?: string;
  rawUri: string;
  error?: string;
}

/**
 * Parses and validates a Digital Receipt QR payload
 */
export function parseReceiptQr(payload: string): ParsedReceiptQr {
  if (!payload || typeof payload !== 'string') {
    return { isValidReceipt: false, error: 'Empty or invalid QR code payload.' };
  }

  const trimmed = payload.trim();

  // 1. Direct token pattern (e.g. tok-..., t-guest-...)
  if (/^t(-guest)?-[a-zA-Z0-9_\-]+$/.test(trimmed) || /^tok-[a-zA-Z0-9_\-]+$/.test(trimmed)) {
    return {
      isValidReceipt: true,
      token: trimmed,
      fullUrl: `/receipt/${trimmed}`,
    };
  }

  // 2. Relative path (e.g. /receipt/:token or /r/:token)
  if (trimmed.startsWith('/receipt/') || trimmed.startsWith('/r/') || trimmed.startsWith('/customer/receipts/')) {
    const parts = trimmed.split('/');
    const token = parts[parts.length - 1].split('?')[0];
    if (token) {
      return {
        isValidReceipt: true,
        token,
        fullUrl: trimmed,
      };
    }
  }

  // 3. Full URL (e.g. https://domain.com/receipt/:token)
  try {
    const url = new URL(trimmed);
    const pathname = url.pathname;
    if (pathname.includes('/receipt/') || pathname.includes('/r/') || pathname.includes('/customer/receipts/')) {
      const parts = pathname.split('/');
      const token = parts[parts.length - 1].split('?')[0];
      if (token) {
        return {
          isValidReceipt: true,
          token,
          fullUrl: trimmed,
        };
      }
    }
  } catch (e) {
    // Not a valid standard URL
  }

  return {
    isValidReceipt: false,
    error: 'This QR code is not a valid ClearBill AI digital receipt. Expected a receipt URL or token.',
  };
}

/**
 * Parses and strictly validates a UPI Payment QR payload (upi://pay?...)
 * Adheres to NPCI UPI Linking Specifications.
 */
export function parseUpiQr(payload: string): ParsedUpiQr {
  if (!payload || typeof payload !== 'string') {
    return { isValidUpi: false, currency: 'INR', rawUri: '', error: 'Empty or invalid QR code payload.' };
  }

  const trimmed = payload.trim();

  // Must follow the standard upi://pay scheme
  if (!trimmed.toLowerCase().startsWith('upi://pay')) {
    return {
      isValidUpi: false,
      currency: 'INR',
      rawUri: trimmed,
      error: 'Invalid QR scheme. This is not a UPI payment QR code (expected upi://pay URI).',
    };
  }

  try {
    // Parse query parameters
    const queryString = trimmed.includes('?') ? trimmed.slice(trimmed.indexOf('?') + 1) : '';
    const params = new URLSearchParams(queryString);

    const pa = params.get('pa'); // Payee VPA / UPI ID (Required)
    const pn = params.get('pn'); // Payee Name (Optional)
    const am = params.get('am'); // Transaction Amount (Optional in generic static QR)
    const cu = params.get('cu') || 'INR'; // Currency (Default: INR)
    const tr = params.get('tr') || params.get('tid'); // Transaction Reference ID
    const tn = params.get('tn'); // Transaction Note

    if (!pa || !pa.trim()) {
      return {
        isValidUpi: false,
        currency: cu,
        rawUri: trimmed,
        error: 'Missing required payee address (pa parameter) in UPI QR code.',
      };
    }

    const cleanPa = pa.trim();
    // Validate VPA structure: name@bank
    const vpaPattern = /^[\w.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    if (!vpaPattern.test(cleanPa)) {
      return {
        isValidUpi: false,
        currency: cu,
        rawUri: trimmed,
        error: `Invalid payee UPI ID format: "${cleanPa}". Expected format: username@bank`,
      };
    }

    let parsedAmount: number | undefined = undefined;
    if (am) {
      const num = parseFloat(am);
      if (!isNaN(num) && num > 0) {
        parsedAmount = Number(num.toFixed(2));
      } else {
        return {
          isValidUpi: false,
          currency: cu,
          rawUri: trimmed,
          error: `Invalid payment amount in QR code: "${am}". Amount must be greater than zero.`,
        };
      }
    }

    return {
      isValidUpi: true,
      payeeVpa: cleanPa,
      payeeName: pn ? decodeURIComponent(pn.trim()) : 'Merchant',
      amount: parsedAmount,
      currency: cu.toUpperCase(),
      transactionRef: tr ? decodeURIComponent(tr.trim()) : undefined,
      note: tn ? decodeURIComponent(tn.trim()) : undefined,
      rawUri: trimmed,
    };
  } catch (err: any) {
    return {
      isValidUpi: false,
      currency: 'INR',
      rawUri: trimmed,
      error: 'Failed to decode UPI payment parameters: ' + err.message,
    };
  }
}
