// src/api.js
import axios from 'axios';

// 1. Point directly to your Django backend
const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Interceptor 1: Attach Token ---
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Interceptor 2: Handle Errors & Refresh ---
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // A. STOP THE LOOP:
    // If the error comes from login or refresh endpoint, DO NOT try to refresh again.
    // Just let the error pass to the Login Page so it can show "Invalid Password".
    if (
        error.config.url.includes('/token/') || 
        error.config.url.includes('/login')
    ) {
        return Promise.reject(error);
    }

    // B. Handle actual session expiry (401) on other pages
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        // No refresh token? Go to login.
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        // Attempt to get a new token
        // We use axios.post (not api.post) to avoid circular interceptors
        const rs = await axios.post(`${API_BASE_URL}/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = rs.data;
        localStorage.setItem('access_token', access);

        // Update headers and retry original request
        api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
        originalRequest.headers['Authorization'] = `Bearer ${access}`;
        return api(originalRequest);

      } catch (refreshError) {
        console.error("Session expired completely:", refreshError);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;