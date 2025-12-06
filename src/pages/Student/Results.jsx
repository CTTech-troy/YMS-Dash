import axios from 'axios';

// Replace your current fetchStudents / fetchClassStudents logic with the resilient helper below
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchStudentsWithRetry(url, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseTimeout = opts.baseTimeout ?? 15000; // 15s base
  let attempt = 0;

  // allow caller to pass params via opts.params
  const params = opts.params ?? {};

  while (attempt < maxAttempts) {
    try {
      const timeout = Math.round(baseTimeout * Math.pow(2, attempt)); // exponential backoff timeout
      const res = await axios.get(url, { timeout, params });
      // normalize to array if the API wraps data
      const data = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.students ?? []);
      return data;
    } catch (err) {
      attempt += 1;
      // final failure -> rethrow
      if (attempt >= maxAttempts) {
        throw err;
      }
      // brief backoff before retrying
      await sleep(250 * attempt);
    }
  }
  return [];
}

// Example usage inside your existing effect / function
// replace calls like: const students = await axios.get(STUDENTS_BASE)...
// with:
try {
  const studentsArray = await fetchStudentsWithRetry(STUDENTS_BASE, { maxAttempts: 3, baseTimeout: 15000, params: {/* optional query params */} });
  setStudents(Array.isArray(studentsArray) ? studentsArray : []);
} catch (err) {
  console.error('Failed to load students', err);
  toast.error('Failed to load students from server. Please try again.');
  setStudents([]); // keep UI stable
}