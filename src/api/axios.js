// src/api/axios.js
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'https://yms-backend-a2x4.onrender.com';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default api;