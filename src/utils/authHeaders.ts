/**
 * Authorization headers utility for ClearBill AI
 * Automatically extracts the active role session token or provides role-appropriate demo fallback.
 */

export function getAuthHeaders(preferredRole: 'retailer' | 'manager' | 'customer' = 'retailer'): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    try {
      if (preferredRole === 'manager') {
        const sess = localStorage.getItem('cb_manager_session');
        if (sess) {
          const parsed = JSON.parse(sess);
          if (parsed.token) headers['Authorization'] = `Bearer ${parsed.token}`;
        }
      } else if (preferredRole === 'customer') {
        const sess = localStorage.getItem('cb_customer_session');
        if (sess) {
          const parsed = JSON.parse(sess);
          if (parsed.token) headers['Authorization'] = `Bearer ${parsed.token}`;
        }
      } else {
        const sess = localStorage.getItem('cb_retailer_session') || localStorage.getItem('cb_manager_session');
        if (sess) {
          const parsed = JSON.parse(sess);
          if (parsed.token) headers['Authorization'] = `Bearer ${parsed.token}`;
        }
      }
    } catch (e) {
      console.warn('[ClearBill] Error reading session headers:', e);
    }
  }

  // Fallback demo tokens for unauthenticated demo navigation
  if (!headers['Authorization']) {
    if (preferredRole === 'manager') {
      headers['Authorization'] = 'Bearer cb_sess_usr-mgr-01';
    } else if (preferredRole === 'customer') {
      headers['Authorization'] = 'Bearer cb_sess_usr-cus-01';
    } else {
      headers['Authorization'] = 'Bearer cb_sess_usr-ret-01';
    }
  }

  return headers;
}
