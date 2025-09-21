// src/api/axios.js
import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const api = axios.create({
  baseURL: API_BASE || undefined, // if empty, use relative paths
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default api;