'use strict';
/**
 * Minimal READ-ONLY Tekmetric API client.
 *
 * Only what the CPTS weekly pull needs: OAuth client-credentials, a GET with
 * retry, and page-walking. No write methods exist here, deliberately - an RO is
 * a legal record and this tool has no business changing one.
 *
 * Ask your Tekmetric rep for READ-ONLY credentials.
 */

const BASE_URL = {
  production: 'https://shop.tekmetric.com',
  sandbox: 'https://sandbox.tekmetric.com',
};

const MAX_PAGE_SIZE = 100;

const REPAIR_ORDER_STATUS = {
  ESTIMATE: 1,
  WORK_IN_PROGRESS: 2,
  COMPLETE: 3,
  SAVED_FOR_LATER: 4,
  POSTED: 5,
  ACCOUNTS_RECEIVABLE: 6,
  DELETED: 7,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class TekmetricError extends Error {
  constructor(message, { status, path } = {}) {
    super(message);
    this.name = 'TekmetricError';
    this.status = status;
    this.path = path;
  }
}

class TekmetricClient {
  constructor({ clientId, clientSecret, environment = 'production', minIntervalMs = 250 } = {}) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.environment = environment;
    this.baseUrl = BASE_URL[environment] || BASE_URL.production;
    this.minIntervalMs = minIntervalMs;
    this.accessToken = null;
    this.scope = null;
    this._lastCall = 0;
  }

  async _throttle() {
    const wait = this.minIntervalMs - (Date.now() - this._lastCall);
    if (wait > 0) await sleep(wait);
    this._lastCall = Date.now();
  }

  /** Exchange client credentials for a bearer token. */
  async authenticate() {
    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        'Tekmetric needs a client id and secret. Put TEKMETRIC_CLIENT_ID and ' +
        'TEKMETRIC_CLIENT_SECRET in the file your config points at with sms.tekmetric.envPath.'
      );
    }

    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`, 'utf8').toString('base64');

    await this._throttle();
    const res = await fetch(`${this.baseUrl}/api/v1/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: 'grant_type=client_credentials',
    });

    const text = await res.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }

    if (!res.ok) {
      throw new TekmetricError(
        `Token exchange failed (${res.status}): ${payload.error || text || 'no body'}`,
        { status: res.status, path: '/api/v1/oauth/token' }
      );
    }

    this.accessToken = payload.access_token;
    // The scope usually names the shop id this token can reach. Handy sanity check.
    this.scope = payload.scope || null;
    return { scope: this.scope };
  }

  /** GET with query params. Retries on 429 and 5xx. */
  async get(reqPath, params = {}, { attempt = 0 } = {}) {
    if (!this.accessToken) await this.authenticate();

    const url = new URL(`${this.baseUrl}${reqPath}`);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
      else url.searchParams.set(k, String(v));
    }

    await this._throttle();
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.accessToken}`, Accept: 'application/json' },
    });

    if (res.status === 401 && attempt === 0) {
      this.accessToken = null;
      return this.get(reqPath, params, { attempt: 1 });
    }

    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await sleep(500 * Math.pow(2, attempt));
      return this.get(reqPath, params, { attempt: attempt + 1 });
    }

    const text = await res.text();
    if (!res.ok) {
      throw new TekmetricError(
        `GET ${reqPath} failed (${res.status}): ${text.slice(0, 300)}`,
        { status: res.status, path: reqPath }
      );
    }

    try { return JSON.parse(text); } catch {
      throw new TekmetricError(`GET ${reqPath} returned non-JSON`, { path: reqPath });
    }
  }

  /** Walk every page of a paged endpoint and return the flattened rows. */
  async getAllPages(reqPath, params = {}, { maxPages = 50 } = {}) {
    const size = Math.min(params.size || MAX_PAGE_SIZE, MAX_PAGE_SIZE);
    const all = [];
    let page = params.page || 0;
    let fetched = 0;

    for (;;) {
      const body = await this.get(reqPath, { ...params, page, size });
      all.push(...(Array.isArray(body?.content) ? body.content : []));
      fetched += 1;

      const totalPages = body?.totalPages ?? 1;
      if (body?.last === true) break;
      if (page + 1 >= totalPages) break;
      if (fetched >= maxPages) {
        console.warn(
          `[tekmetric] stopped paginating ${reqPath} at ${maxPages} pages ` +
          `(API reported ${totalPages}). Raise maxPages if that is expected.`
        );
        break;
      }
      page += 1;
    }

    return all;
  }

  /** Proves auth works and shows which shop the token can reach. Good first call. */
  listShops() {
    return this.get('/api/v1/shops');
  }
}

module.exports = { TekmetricClient, TekmetricError, REPAIR_ORDER_STATUS };
