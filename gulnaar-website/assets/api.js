(function () {
  const defaultBase = window.KHAN_API_BASE || '/api';
  const BASE_URL = String(defaultBase).replace(/\/$/, '');

  async function request(path, options = {}) {
    const url = `${BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
    const headers = new Headers(options.headers || {});
    const token = sessionStorage.getItem('khan_admin_token');
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    const responseText = await response.text();
    let payload = null;
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch (error) {
      payload = responseText;
    }

    if (!response.ok) {
      const error = new Error((payload && payload.message) || `API request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  window.KhanAPI = {
    config: { baseUrl: BASE_URL },
    async products() {
      return request('/products');
    },
    async product(id) {
      return request(`/products/${encodeURIComponent(id)}`);
    },
    async createOrder(payload) {
      return request('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async trackOrder(code, phone) {
      return request(`/orders/track?code=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`);
    },
    async adminLogin(payload) {
      return request('/admin/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async adminOrders() {
      return request('/admin/orders');
    },
    async adminPayments() {
      return request('/admin/payments');
    },
    async updateOrderStatus(code, status, note) {
      return request(`/admin/orders/${encodeURIComponent(code)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note }),
      });
    },
    async shipOrder(code, cn) {
      return request(`/admin/orders/${encodeURIComponent(code)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Shipped', cn, note: `Handed to courier — CN ${cn}` }),
      });
    },
    async verifyPayment(code, approved) {
      return request(`/admin/payments/${encodeURIComponent(code)}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ approved }),
      });
    },
  };
})();
