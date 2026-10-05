const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Calls fn until it succeeds or attempts run out, waiting between attempts.
export async function retry(fn, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) await sleep(500);
    }
  }
  throw lastError;
}
