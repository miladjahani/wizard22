// ═══════════════════════════════════════════════════════════
//  ⚡ miliconfigV2 — ویزارد نصب خودکار PWA (فایل واحد)
//  فقط توکن بگیر → همه‌چیز خودکار → با rebranding کامل
// ═══════════════════════════════════════════════════════════

const WIZARD_NAME = "miliconfigV2";
const WIZARD_DISPLAY = "miliconfigV2";
const SUPPORT_TELEGRAM = "https://t.me/MILICONFIG_V2";
const SUPPORT_GITHUB = "https://github.com/miliconfigV2/miliconfigV2";

/* ──────────────────────────────────────────────
   لینک ساخت خودکار توکن (با دسترسی‌های کامل)
────────────────────────────────────────────── */
const TOKEN_URL = "https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_kv_storage%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22page%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22dns%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22user_details%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22d1%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22d1%22%2C%22type%22%3A%22read%22%7D%5D&accountId=*&zoneId=all&name=miliconfig";

/* ──────────────────────────────────────────────
   سورس اصلی پنل (با rebranding کامل)
────────────────────────────────────────────── */
const PANEL_SOURCE = `import { connect } from "cloudflare:sockets";
const GLOBAL_TRAFFIC_CACHE = new Map();
const ACTIVE_CONNECTIONS_COUNT = new Map();
const GLOBAL_LAST_ACTIVE_WRITE = new Map();
const GLOBAL_LAST_DB_WRITE = new Map();
const GLOBAL_WRITE_LOCK = new Map();
const DNS_CACHE = new Map();
const USER_REQ_CACHE = new Map();
const LOGIN_ATTEMPTS = new Map();
let GLOBAL_REQ_COUNT = 0;
let GLOBAL_LAST_REQ_WRITE = 0;
const DNS_CACHE_TTL = 5 * 60 * 1000;
const DOH_RESOLVER = "https://cloudflare-dns.com/dns-query";
const UPSTREAM_BUNDLE_TARGET_BYTES = 128 * 1024;
const UPSTREAM_QUEUE_MAX_BYTES = 16 * 1024 * 1024;
const UPSTREAM_QUEUE_MAX_ITEMS = 4096;
const DOWNSTREAM_GRAIN_BYTES = 32 * 1024;
const DOWNSTREAM_GRAIN_TAIL_THRESHOLD = 512;
const DOWNSTREAM_GRAIN_SILENT_MS = 1;
const DNS_CACHE_MAX_ENTRIES = 2048;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const TLS_PORTS = new Set(["443", "2053", "2083", "2087", "2096", "8443"]);
function safeDecodeURI(value) {
  try { return decodeURIComponent(value); } catch (e) { return value; }
}
async function readJsonBody(request) {
  try { const body = await request.json(); return body && typeof body === "object" ? body : {}; } catch (e) { return {}; }
}
async function fetchWithFallback(path, options = {}) {
  const githubUrl = \`https://raw.githubusercontent.com/miliconfigV2/miliconfigV2/main/\${path}\`;
  const staticUrl = \`https://miliconfig-files.surge.sh/\${path}\`;
  try { const res = await fetch(githubUrl, options); if (res.ok) return res; } catch (e) {}
  return await fetch(staticUrl, options);
}
let localLastAutoResetCheck = 0;
async function checkAutoResets(env, ctx) {
  const now = Date.now();
  if (now - localLastAutoResetCheck < 3600000) return;
  try {
    const cache = caches.default;
    const cacheReq = new Request("https://internal.miliconfig/auto_reset");
    if (await cache.match(cacheReq)) return;
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'last_auto_reset_check'").first();
    const dbLastCheck = row ? parseInt(row.value) || 0 : 0;
    if (now - dbLastCheck < 3600000) {
      localLastAutoResetCheck = dbLastCheck;
      const ttl = Math.floor((3600000 - (now - dbLastCheck)) / 1000);
      if (ttl > 0 && ctx) ctx.waitUntil(cache.put(cacheReq, new Response("1", { headers: { "Cache-Control": \`max-age=\${ttl}\` } })));
      return;
    }
    await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_auto_reset_check', ?)").bind(String(now)).run();
    localLastAutoResetCheck = now;
    if (ctx) ctx.waitUntil(cache.put(cacheReq, new Response("1", { headers: { "Cache-Control": "max-age=3600" } })));
    const todayUtc = Math.floor(now / 86400000) * 86400000;
    await env.DB.prepare(\`UPDATE users SET used_gb = 0, is_active = 1, last_reset_vol_time = ? WHERE auto_reset_vol_days > 0 AND ? >= (last_reset_vol_time + (auto_reset_vol_days * 86400000))\`).bind(todayUtc, todayUtc).run();
    await env.DB.prepare(\`UPDATE users SET used_req = 0, is_active = 1, last_reset_req_time = ? WHERE auto_reset_req_days > 0 AND ? >= (last_reset_req_time + (auto_reset_req_days * 86400000))\`).bind(todayUtc, todayUtc).run();
  } catch (e) {}
}
let localLastIpRotateCheck = 0;
async function checkAutoRotates(env, ctx) {
  const now = Date.now();
  if (now - localLastIpRotateCheck < 60000) return;
  try {
    const cache = caches.default;
    const cacheReq = new Request("https://internal.miliconfig/auto_rotate");
    if (await cache.match(cacheReq)) return;
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'last_ip_rotate_check'").first();
    const dbLastCheck = row ? parseInt(row.value) || 0 : 0;
    if (now - dbLastCheck < 60000) {
      localLastIpRotateCheck = dbLastCheck;
      const ttl = Math.floor((60000 - (now - dbLastCheck)) / 1000);
      if (ttl > 0 && ctx) ctx.waitUntil(cache.put(cacheReq, new Response("1", { headers: { "Cache-Control": \`max-age=\${ttl}\` } })));
      return;
    }
    await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_ip_rotate_check', ?)").bind(String(now)).run();
    localLastIpRotateCheck = now;
    if (ctx) ctx.waitUntil(cache.put(cacheReq, new Response("1", { headers: { "Cache-Control": "max-age=60" } })));
    const { results: usersToRotate } = await env.DB.prepare("SELECT * FROM users WHERE auto_rotate_ip = 1 AND ? >= (last_rotate_time + (rotate_time * 60000))").bind(now).all();
    if (!usersToRotate || usersToRotate.length === 0) return;
    const res = await fetchWithFallback("ips.txt");
    if (!res.ok) return;
    const text = await res.text();
    const blocks = text.split("----------");
    let cachedIpsData = {};
    blocks.forEach((block) => {
      const lines = block.trim().split("\\n").map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length === 0) return;
      let opName = "Unknown";
      const ips = [];
      lines.forEach((line) => {
        if (line.includes("#")) opName = line.split("#")[1].trim();
        else if (!line.startsWith("[source")) ips.push(line);
      });
      if (ips.length > 0) cachedIpsData[opName] = ips;
    });
    const stmts = [];
    for (const u of usersToRotate) {
      let availableIps = [];
      if (u.ip_operator === "all") { Object.values(cachedIpsData).forEach((ips) => (availableIps = availableIps.concat(ips))); }
      else { availableIps = cachedIpsData[u.ip_operator] || []; }
      availableIps = [...new Set(availableIps)];
      let count = u.ip_count || 20;
      let selectedIps = [];
      if (count >= availableIps.length) { selectedIps = availableIps; }
      else {
        const shuffled = availableIps.slice();
        for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
        selectedIps = shuffled.slice(0, count);
      }
      if (selectedIps.length > 0) { stmts.push(env.DB.prepare("UPDATE users SET ips = ?, last_rotate_time = ? WHERE id = ?").bind(selectedIps.join("\\n"), now, u.id)); }
    }
    if (stmts.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < stmts.length; i += batchSize) { await env.DB.batch(stmts.slice(i, i + batchSize)); }
    }
  } catch (e) {}
}
let cachedVipCountries = [];
let lastVipCountriesFetch = 0;
async function replaceBrokenProxy(username, env, oldProxy) {
  try {
    if (GLOBAL_WRITE_LOCK.get(username + "_proxy_rotate")) return;
    GLOBAL_WRITE_LOCK.set(username + "_proxy_rotate", true);
    const user = await env.DB.prepare("SELECT id, user_socks5, auto_rotate_user_proxy FROM users WHERE username = ?").bind(username).first();
    if (!user || user.auto_rotate_user_proxy !== 1 || !user.user_socks5) { GLOBAL_WRITE_LOCK.delete(username + "_proxy_rotate"); return; }
    let proxyList = [];
    let isArrayMode = false;
    try {
      if (user.user_socks5.trim().startsWith("[")) { proxyList = JSON.parse(user.user_socks5); isArrayMode = true; }
      else { proxyList = [user.user_socks5]; }
    } catch (e) { proxyList = [user.user_socks5]; }
    let matchIndex = -1;
    for (let i = 0; i < proxyList.length; i++) {
      let itemStr = typeof proxyList[i] === "object" && proxyList[i] !== null ? proxyList[i].proxy : proxyList[i];
      if (itemStr === oldProxy) { matchIndex = i; break; }
    }
    if (matchIndex === -1) { GLOBAL_WRITE_LOCK.delete(username + "_proxy_rotate"); return; }
    let countryCode = (typeof proxyList[matchIndex] === "object" && proxyList[matchIndex] !== null && proxyList[matchIndex].country) ? proxyList[matchIndex].country : "all";
    try {
      const payload = new TextEncoder().encode("GET /json/?fields=countryCode HTTP/1.1\\r\\nHost: ip-api.com\\r\\nConnection: close\\r\\n\\r\\n");
      const s = await connectProxy(oldProxy, "ip-api.com", 80, payload);
      const reader = s.readable.getReader();
      let resStr = "";
      const dec = new TextDecoder();
      const timeoutId = setTimeout(() => { try { s.close(); } catch(e){} }, 2000);
      try {
        while (true) { const res = await reader.read(); if (res.done || !res.value) break; resStr += dec.decode(res.value, { stream: true }); if (resStr.includes("countryCode")) break; }
      } finally { clearTimeout(timeoutId); try { s.close(); } catch (e) {} }
      const jsonMatch = resStr.match(/{[^}]"countryCode"\\s*:\\s*"([^"]+)"[^}]*}/);
      if (jsonMatch && jsonMatch[1]) countryCode = jsonMatch[1];
    } catch (e) {}
    if (countryCode === "all") {
      try {
        let remain = oldProxy.replace(/^(socks4|socks5|socks|http|https):\\/\\//i, "");
        if (remain.includes("@")) remain = remain.substring(remain.lastIndexOf("@") + 1);
        if (remain.startsWith("[")) remain = remain.substring(1, remain.indexOf("]"));
        else if (remain.includes(":")) remain = remain.substring(0, remain.lastIndexOf(":"));
        const geoRes = await fetch(\`http://ip-api.com/json/\${remain}?fields=countryCode\`);
        const geoData = await geoRes.json();
        if (geoData && geoData.countryCode) countryCode = geoData.countryCode;
      } catch (e) {}
    }
    let newProxy = null;
    const upperCountry = countryCode.toUpperCase();
    const sources = [];
    const isOldProxyVIP = oldProxy.includes("@");
    if (cachedVipCountries.length === 0 || Date.now() - lastVipCountriesFetch > 3600000) {
      try {
        const ghRes = await fetchWithFallback("vip-list", { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });
        if (ghRes.ok) { const files = await ghRes.json(); cachedVipCountries = files.filter(f => f.name.endsWith('.txt')).map(f => f.name.replace('.txt', '').toUpperCase()); lastVipCountriesFetch = Date.now(); }
      } catch (e) {}
    }
    let fallbackVIPs = cachedVipCountries.length > 0 ? [...cachedVipCountries] : ["DE", "US", "GB", "NL", "FR", "TR"];
    for (let i = fallbackVIPs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [fallbackVIPs[i], fallbackVIPs[j]] = [fallbackVIPs[j], fallbackVIPs[i]]; }
    if (upperCountry !== "ALL" && upperCountry !== "UN") { sources.push({ url: \`proxy_vip/\${upperCountry}.txt\`, type: 'repo' }); }
    for (const fc of fallbackVIPs) { if (fc !== upperCountry) { sources.push({ url: \`proxy_vip/\${fc}.txt\`, type: 'repo' }); } }
    if (!isOldProxyVIP) {
      if (upperCountry !== "ALL" && upperCountry !== "UN") { sources.push({ url: \`proxy/\${upperCountry}.txt\`, type: 'repo' }); }
      sources.push({ url: "proxy/ALL.txt", type: 'repo' });
    }
    for (const src of sources) {
      try {
        const res = await fetchWithFallback(src.url);
        if (!res.ok) continue;
        const text = await res.text();
        const lines = text.split("\\n").map(l => l.trim()).filter(l => l.length > 5);
        if (lines.length > 0) {
          for (let i = lines.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [lines[i], lines[j]] = [lines[j], lines[i]]; }
          const testBatch = lines.slice(0, 3).flatMap(line => {
            if (line.match(/^(socks4|socks5|socks|http|https|tg):\\/\\//i) || line.includes("t.me/socks")) { return [line]; }
            if (src.type === 'socks5') return [\`socks5://\${line}\`];
            if (src.type === 'http') return [\`http://\${line}\`];
            return [\`socks5://\${line}\`, \`http://\${line}\`];
          });
          try {
            newProxy = await Promise.any(testBatch.map(p => {
              return new Promise(async (resolve, reject) => {
                let sock = null;
                const timeoutId = setTimeout(() => { try { sock && sock.close(); } catch (e) {} reject(new Error('timeout')); }, 3000);
                try {
                  const payload = TEXT_ENCODER.encode("GET / HTTP/1.1\\r\\nHost: 1.1.1.1\\r\\nConnection: close\\r\\n\\r\\n");
                  sock = await connectProxy(p, "1.1.1.1", 80, payload);
                  const reader = sock.readable.getReader();
                  const res = await reader.read();
                  clearTimeout(timeoutId);
                  try { sock.close(); } catch (e) {}
                  if (res.done || !res.value) reject(new Error("empty")); else resolve(p);
                } catch (e) { clearTimeout(timeoutId); try { sock && sock.close(); } catch (err) {} reject(e); }
              });
            }));
          } catch (e) { continue; }
          if (newProxy) { break; }
        }
      } catch (e) {}
    }
    if (newProxy) {
      let finalProxyVal = newProxy;
      if (isArrayMode) {
        if (typeof proxyList[matchIndex] === "object" && proxyList[matchIndex] !== null) { proxyList[matchIndex].proxy = newProxy; }
        else { proxyList[matchIndex] = newProxy; }
        finalProxyVal = JSON.stringify(proxyList);
      }
      await env.DB.prepare("UPDATE users SET user_socks5 = ? WHERE id = ?").bind(finalProxyVal, user.id).run();
    }
  } catch(e) {
  } finally { GLOBAL_WRITE_LOCK.delete(username + "_proxy_rotate"); }
}
export default {
  async fetch(request, env, ctx) {
    if (!env.DB) { return new Response("Database binding 'DB' is missing.", { status: 500 }); }
    try {
      try { await DbService.ensureSchema(env.DB); } catch (e) {}
      trackRequest(env, ctx);
      if (schemaEnsured) { ctx.waitUntil(checkAutoResets(env, ctx)); ctx.waitUntil(checkAutoRotates(env, ctx)); }
      const url = new URL(request.url);
      if (Router.isWebSocketUpgrade(request)) { return await Router.handleWebSocket(request, env, ctx); }
      if (Router.isSubscriptionPath(url.pathname)) { return await Router.handleSubscription(url, env); }
      if (url.pathname.startsWith("/api/")) { return await Router.handleApi(request, url, env, ctx); }
      if (url.pathname === "/panel" || url.pathname === "/login") { return await Router.handlePanel(request, env); }
      if (url.pathname.startsWith("/status/")) { return await Router.handleUserStatus(url, env); }
      return new Response(HTML_TEMPLATES.nginx, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    } catch (err) { return new Response("Internal Server Error", { status: 500 }); }
  },
};
const Router = {
  isWebSocketUpgrade(request) { const upgradeHeader = (request.headers.get("Upgrade") || "").toLowerCase(); return upgradeHeader === "websocket"; },
  isSubscriptionPath(pathname) { return pathname.startsWith("/sub/") || pathname.startsWith("/feed/"); },
  async handleWebSocket(request, env, ctx) { try { return await handlevIees(env, null, ctx, request); } catch (e) { return new Response("Internal Server Error", { status: 500 }); } },
  async handleSubscription(url, env) {
    const isSubPath = url.pathname.startsWith("/sub/");
    const offset = isSubPath ? 5 : 6;
    let subUser = safeDecodeURI(url.pathname.slice(offset));
    const host = url.hostname;
    try {
      const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE OR uuid = ?").bind(subUser, subUser).first();
      if (!user || user.connection_type !== "vless") { return new Response("Not Found", { status: 404 }); }
      try { await env.DB.prepare("UPDATE users SET used_req = used_req + 1 WHERE username = ?").bind(user.username).run(); } catch (e) {}
      return await SubscriptionService.generateText(user, host);
    } catch (err) { return new Response("Error building config: " + err.message, { status: 500 }); }
  },
  async handlePanel(request, env) {
    const hasPassword = await DbService.getPanelPassword(env.DB);
    if (!hasPassword) { return new Response(HTML_TEMPLATES.setup, { headers: { "Content-Type": "text/html; charset=utf-8" } }); }
    const authorized = await DbService.verifyApiAuth(request, env);
    if (!authorized) { return new Response(HTML_TEMPLATES.login, { headers: { "Content-Type": "text/html; charset=utf-8" } }); }
    return new Response(HTML_TEMPLATES.panel, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" } });
  },
  async handleUserStatus(url, env) {
    const username = safeDecodeURI(url.pathname.slice(8));
    if (!username) { return new Response("Username is required", { status: 400 }); }
    try {
      const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE OR uuid = ?").bind(username, username).first();
      if (!user) { return new Response("User not found", { status: 404 }); }
      const userJson = JSON.stringify({ username: user.username, uuid: user.uuid, limit_gb: user.limit_gb, expiry_days: user.expiry_days, used_gb: user.used_gb, limit_req: user.limit_req, used_req: user.used_req, is_active: user.is_active, online_count: getActiveIpCount(user.active_ips), ip_limit: user.ip_limit, created_at: user.created_at, tls: user.tls, port: user.port, ips: user.ips, fingerprint: user.fingerprint || "chrome", user_proxy_iata: user.user_proxy_iata, user_socks5: user.user_socks5, user_proxy_ip: user.user_proxy_ip });
      const html = HTML_TEMPLATES.status.replace("{{USER_DATA_PLACEHOLDER}}", \`window.statusUser = \${userJson};\`);
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    } catch (err) { return new Response("Error: " + err.message, { status: 500 }); }
  },
  async handleApi(request, url, env, ctx) {
    const hasPassword = await DbService.getPanelPassword(env.DB);
    if (url.pathname === "/api/setup-password" && request.method === "POST") {
      if (hasPassword) { return new Response(JSON.stringify({ error: "رمز عبور از قبل تعریف شده است" }), { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
      const { password } = await readJsonBody(request);
      if (!password || password.length < 4) { return new Response(JSON.stringify({ error: "رمز عبور باید حداقل ۴ کاراکتر باشد" }), { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
      const hashed = await DbService.sha256(password);
      await DbService.setPanelPassword(env.DB, hashed);
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json; charset=utf-8", "Set-Cookie": "panel_session=" + hashed + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000" } });
    }
    if (url.pathname === "/api/login" && request.method === "POST") {
      const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
      const now = Date.now();
      if (LOGIN_ATTEMPTS.size > 256) { for (const [ip, rec] of LOGIN_ATTEMPTS) { if (now - rec.lastAttempt > 900000) LOGIN_ATTEMPTS.delete(ip); } }
      const attemptRecord = LOGIN_ATTEMPTS.get(clientIP) || { count: 0, lastAttempt: 0 };
      if (attemptRecord.count >= 5 && (now - attemptRecord.lastAttempt) < 900000) { const remaining = Math.ceil((900000 - (now - attemptRecord.lastAttempt)) / 60000); return new Response(JSON.stringify({ error: \`دسترسی شما مسدود شد. لطفاً \${remaining} دقیقه دیگر تلاش کنید.\` }), { status: 429, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
      const { password } = await readJsonBody(request);
      const hashedInput = await DbService.sha256(password);
      const storedHash = await DbService.getPanelPassword(env.DB);
      let isValid = false;
      if (storedHash === hashedInput) { isValid = true; } else { const oldHashedInput = await DbService.oldSha256(password); if (storedHash === oldHashedInput) { isValid = true; await DbService.setPanelPassword(env.DB, hashedInput); } }
      if (isValid) { LOGIN_ATTEMPTS.delete(clientIP); return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json; charset=utf-8", "Set-Cookie": "panel_session=" + hashedInput + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000" } }); }
      else { attemptRecord.count = (now - attemptRecord.lastAttempt > 900000) ? 1 : attemptRecord.count + 1; attemptRecord.lastAttempt = now; LOGIN_ATTEMPTS.set(clientIP, attemptRecord); return new Response(JSON.stringify({ error: \`رمز عبور اشتباه است (تلاش‌های باقی‌مانده: \${5 - attemptRecord.count})\` }), { status: 401, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
    }
    if (url.pathname === "/api/logout" && request.method === "POST") { return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json; charset=utf-8", "Set-Cookie": "panel_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax" } }); }
    if (url.pathname === "/api/recover" && request.method === "POST") {
      const { api_token } = await readJsonBody(request);
      if (!api_token) { return new Response(JSON.stringify({ error: "Token is required" }), { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
      try {
        const cfRes = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", { headers: { Authorization: "Bearer " + api_token } });
        const cfData = await cfRes.json();
        if (!cfRes.ok || !cfData.success) { return new Response(JSON.stringify({ error: "Invalid or expired Cloudflare token" }), { status: 401, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
        const host = url.hostname;
        let isAuthorized = false;
        if (host.endsWith(".workers.dev")) {
          const parts = host.split(".");
          const targetSubdomain = parts[parts.length - 3];
          const accountsRes = await fetch("https://api.cloudflare.com/client/v4/accounts", { headers: { Authorization: "Bearer " + api_token } });
          const accountsData = await accountsRes.json();
          if (accountsData.success && accountsData.result) {
            for (const acc of accountsData.result) {
              const subRes = await fetch(\`https://api.cloudflare.com/client/v4/accounts/\${acc.id}/workers/subdomain\`, { headers: { Authorization: "Bearer " + api_token } });
              const subData = await subRes.json();
              if (subData.success && subData.result && subData.result.subdomain === targetSubdomain) { isAuthorized = true; break; }
            }
          }
        } else {
          const zonesRes = await fetch("https://api.cloudflare.com/client/v4/zones", { headers: { Authorization: "Bearer " + api_token } });
          const zonesData = await zonesRes.json();
          if (zonesData.success && zonesData.result) { for (const zone of zonesData.result) { if (host === zone.name || host.endsWith("." + zone.name)) { isAuthorized = true; break; } } }
        }
        if (!isAuthorized) { return new Response(JSON.stringify({ error: "این توکن متعلق به صاحب پنل نیست" }), { status: 403, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
        await env.DB.prepare("DELETE FROM settings WHERE key = 'panel_password'").run();
        cachedPanelPassword = null;
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json; charset=utf-8" } });
      } catch (err) { return new Response(JSON.stringify({ error: "Cloudflare API connection error" }), { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
    }
    const authorized = await DbService.verifyApiAuth(request, env);
    if (!authorized && url.pathname !== "/api/test-proxy") { return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
    if (url.pathname === "/api/auto-update-setup" && request.method === "POST") {
      const body = await readJsonBody(request);
      if (body.action === "check") {
        const dbTokenRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'cf_token'").first();
        const hasToken = !!env.CF_API_TOKEN || !!(dbTokenRow && dbTokenRow.value);
        const autoUpdateRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'auto_update'").first();
        const isAutoUpdateEnabled = autoUpdateRow ? autoUpdateRow.value === '1' : false;
        return new Response(JSON.stringify({ has_token: hasToken, auto_update: isAutoUpdateEnabled }), { headers: { "Content-Type": "application/json" } });
      }
      if (body.action === "enable") {
        const dbTokenRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'cf_token'").first();
        let token = body.token || env.CF_API_TOKEN || (dbTokenRow ? dbTokenRow.value : null);
        if (!token) return new Response(JSON.stringify({ error: "TOKEN_MISSING" }), { status: 400, headers: { "Content-Type": "application/json" } });
        try {
          const cfRes = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", { headers: { Authorization: "Bearer " + token } });
          const cfData = await cfRes.json();
          if (!cfRes.ok || !cfData.success) { return new Response(JSON.stringify({ error: "INVALID_TOKEN" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
          await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('cf_token', ?)").bind(token).run();
          await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_update', '1')").run();
          return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } catch(e) { return new Response(JSON.stringify({ error: "خطا در بررسی توکن با کلودفلر" }), { status: 500, headers: { "Content-Type": "application/json" } }); }
      }
      if (body.action === "disable") {
        await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_update', '0')").run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }
    }
    if (url.pathname === "/api/restart-core" && request.method === "POST") {
      try {
        GLOBAL_TRAFFIC_CACHE.clear(); ACTIVE_CONNECTIONS_COUNT.clear(); GLOBAL_LAST_ACTIVE_WRITE.clear(); GLOBAL_LAST_DB_WRITE.clear(); GLOBAL_WRITE_LOCK.clear(); DNS_CACHE.clear(); USER_REQ_CACHE.clear();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      } catch (err) { return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } }); }
    }
    if (url.pathname === "/api/update-panel" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const dbTokenRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'cf_token'").first();
      let currentToken = env.CF_API_TOKEN || (dbTokenRow ? dbTokenRow.value : null) || body.cf_token || null;
      let currentAccountId = env.CF_ACCOUNT_ID;
      if (!currentToken) { return new Response(JSON.stringify({ error: "TOKEN_REQUIRED" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
      try {
        const cfHeaders = { "Authorization": "Bearer " + currentToken, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) miliconfigV2/1.0" };
        if (!currentAccountId) {
          const accRes = await fetch("https://api.cloudflare.com/client/v4/accounts", { headers: cfHeaders });
          if (!accRes.ok) throw new Error("کلودفلر درخواست اکانت را رد کرد (وضعیت: " + accRes.status + ")");
          const accData = await accRes.json().catch(() => ({}));
          if (!accData.success || !accData.result || accData.result.length === 0) throw new Error("توکن نامعتبر است یا اکانتی یافت نشد.");
          currentAccountId = accData.result[0].id;
        }
        const githubRes = await fetchWithFallback("miliconfig.obfuscated.js?t=" + Date.now(), { headers: { "User-Agent": "Mozilla/5.0", "Cache-Control": "no-cache" } });
        if (!githubRes.ok) throw new Error("خطا در دریافت سورس جدید از گیت‌هاب (وضعیت: " + githubRes.status + ")");
        const newCode = await githubRes.text();
        const scriptName = env.WORKER_NAME || url.hostname.split(".")[0];
        const bindingsRes = await fetch(\`https://api.cloudflare.com/client/v4/accounts/\${currentAccountId}/workers/scripts/\${scriptName}/bindings\`, { headers: cfHeaders });
        if (!bindingsRes.ok) throw new Error("عدم دسترسی به تنظیمات ورکر. کلودفلر خطا داد (وضعیت: " + bindingsRes.status + ")");
        const bindingsData = await bindingsRes.json().catch(() => ({}));
        if (!bindingsData.success) throw new Error("توکن فاقد دسترسی ویرایش ورکر است.");
        const newBindings = [];
        for (const b of bindingsData.result || []) {
          if (b.name === "CF_API_TOKEN" || b.name === "CF_ACCOUNT_ID") continue;
          if (b.type === "d1") { newBindings.push({ type: "d1", name: b.name, id: b.database_id || b.id }); }
          else if (b.type === "kv_namespace") { newBindings.push({ type: "kv_namespace", name: b.name, namespace_id: b.namespace_id || b.id }); }
          else if (b.type === "plain_text") { newBindings.push({ type: "plain_text", name: b.name, text: b.text || "" }); }
          else if (b.type !== "secret_text") { newBindings.push(b); }
        }
        newBindings.push({ type: "secret_text", name: "CF_API_TOKEN", text: currentToken });
        newBindings.push({ type: "secret_text", name: "CF_ACCOUNT_ID", text: currentAccountId });
        const metadata = { main_module: "miliconfig.js", compatibility_date: "2026-07-10", compatibility_flags: ["nodejs_compat"], bindings: newBindings };
        const formData = new FormData();
        formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }), "metadata.json");
        formData.append("miliconfig.js", new Blob([newCode], { type: "application/javascript+module" }), "miliconfig.js");
        const deployRes = await fetch(\`https://api.cloudflare.com/client/v4/accounts/\${currentAccountId}/workers/scripts/\${scriptName}\`, { method: "PUT", headers: cfHeaders, body: formData });
        if (!deployRes.ok) { const errText = await deployRes.text().catch(() => ""); throw new Error("خطای کلودفلر هنگام دیپلوی (" + deployRes.status + "): " + errText.substring(0, 150)); }
        const deployData = await deployRes.json().catch(() => ({}));
        if (!deployData.success) { const cfError = deployData.errors && deployData.errors.length > 0 ? deployData.errors[0].message : "خطا در اعمال آپدیت."; throw new Error(cfError); }
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      } catch (err) { return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { "Content-Type": "application/json" } }); }
    }
    if (url.pathname === "/api/change-password" && request.method === "POST") {
      const { current_password, new_password } = await readJsonBody(request);
      if (!current_password || !new_password) { return new Response(JSON.stringify({ error: "رمز عبور فعلی و جدید الزامی هستند" }), { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
      const currentHash = await DbService.sha256(current_password);
      const oldCurrentHash = await DbService.oldSha256(current_password);
      const storedHash = await DbService.getPanelPassword(env.DB);
      if (storedHash && storedHash !== currentHash && storedHash !== oldCurrentHash) { return new Response(JSON.stringify({ error: "رمز عبور فعلی اشتباه است" }), { status: 401, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
      if (new_password.length < 4) { return new Response(JSON.stringify({ error: "رمز عبور جدید باید حداقل ۴ کاراکتر باشد" }), { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
      const newHash = await DbService.sha256(new_password);
      await DbService.setPanelPassword(env.DB, newHash);
      return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json; charset=utf-8", "Set-Cookie": "panel_session=" + newHash + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000" } });
    }
    if (url.pathname === "/api/settings/bulk") {
      if (request.method === "GET") {
        try { const { results } = await env.DB.prepare("SELECT * FROM settings").all(); const settingsObj = {}; if (results) { results.forEach((r) => { if (r.key !== 'cf_token' && r.key !== 'panel_password') settingsObj[r.key] = r.value; }); } return new Response(JSON.stringify(settingsObj), { headers: { "Content-Type": "application/json" } }); }
        catch (e) { return new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } }); }
      }
      if (request.method === "POST") { const body = await readJsonBody(request); if (body.settings && typeof body.settings === "object") { for (const [k, v] of Object.entries(body.settings)) { await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").bind(k, String(v)).run(); } } return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } }); }
    }
    if (url.pathname === "/api/proxy-ip") {
      if (request.method === "POST") {
        const { proxy_ip, iata, socks5 } = await readJsonBody(request);
        if (proxy_ip) await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('proxy_ip', ?)").bind(proxy_ip).run();
        if (iata !== undefined) await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('proxy_location_iata', ?)").bind(iata).run();
        if (socks5 !== undefined) await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('socks5', ?)").bind(socks5).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }
      if (request.method === "GET") {
        const rowIp = await env.DB.prepare("SELECT value FROM settings WHERE key = 'proxy_ip'").first();
        const rowIata = await env.DB.prepare("SELECT value FROM settings WHERE key = 'proxy_location_iata'").first();
        const rowSocks = await env.DB.prepare("SELECT value FROM settings WHERE key = 'socks5'").first();
        return new Response(JSON.stringify({ proxy_ip: rowIp ? rowIp.value : "", iata: rowIata ? rowIata.value : "", socks5: rowSocks ? rowSocks.value : "" }), { headers: { "Content-Type": "application/json" } });
      }
    }
    if (url.pathname === "/api/test-proxy" && request.method === "POST") {
      const { proxy } = await readJsonBody(request);
      if (!proxy) return new Response(JSON.stringify({ error: "پروکسی وارد نشده است" }), { status: 400, headers: { "Content-Type": "application/json" } });
      try {
        let ip = "";
        let workingProxy = proxy;
        if (proxy.includes("t.me/socks") || proxy.includes("tg://socks")) { ip = proxy.match(/server=([^&]+)/)?.[1] || ""; }
        else {
          let cleanProxy = proxy.replace(/^(socks4|socks5|socks|http|https):\\/\\//i, "");
          let remain = cleanProxy;
          if (remain.includes("@")) remain = remain.substring(remain.lastIndexOf("@") + 1);
          if (remain.startsWith("[")) { ip = remain.substring(1, remain.indexOf("]")); }
          else { const lastColon = remain.lastIndexOf(":"); if (lastColon !== -1 && remain.indexOf(":") === lastColon) ip = remain.substring(0, lastColon); else ip = remain; }
        }
        let country = "UN";
        const startTime = Date.now();
        const payload = new TextEncoder().encode("GET /json/?fields=countryCode HTTP/1.1\\r\\nHost: ip-api.com\\r\\nConnection: close\\r\\n\\r\\n");
        const s = await connectProxy(proxy, "ip-api.com", 80, payload);
        const reader = s.readable.getReader();
        let resStr = "";
        const dec = new TextDecoder();
        try { while (true) { const res = await reader.read(); if (res.done || !res.value) break; resStr += dec.decode(res.value, { stream: true }); if (resStr.includes("countryCode")) break; } }
        finally { try { s.close(); } catch (e) {} }
        if (!resStr) { throw new Error("تایم‌اوت در دریافت دیتا"); }
        const ping = Date.now() - startTime;
        try { const jsonMatch = resStr.match(/{[^}]"countryCode"\\s*:\\s*"([^"]+)"[^}]*}/); if (jsonMatch && jsonMatch[1]) country = jsonMatch[1]; } catch (e) {}
        if (country === "UN" && ip) { try { const geoRes = await fetch(\`http://ip-api.com/json/\${ip}?fields=countryCode\`); const geoData = await geoRes.json(); if (geoData && geoData.countryCode) country = geoData.countryCode; } catch (e) {} }
        return new Response(JSON.stringify({ success: true, ping, country }), { headers: { "Content-Type": "application/json" } });
      } catch (e) {
        let msg = e.message;
        if (msg.includes("Stream was cancelled") || msg.includes("network")) msg = "ارتباط با سرور قطع شد (احتمالاً پروکسی مسدود یا خاموش است)";
        else if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("تایم‌اوت")) msg = "تایم‌اوت در اتصال (پروکسی در دسترس نیست)";
        else if (msg.includes("Invalid URL") || msg.includes("Invalid format")) msg = "فرمت وارد شده برای پروکسی اشتباه است";
        else if (msg === "err") msg = "خطای نامشخص (ارتباط برقرار نشد)";
        return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }
    if (url.pathname.startsWith("/api/users")) {
      const pathParts = url.pathname.split("/");
      const isUserAction = pathParts.length > 3;
      if (isUserAction) {
        const username = safeDecodeURI(pathParts.pop());
        if (request.method === "PUT") {
          const body = await readJsonBody(request);
          if (Object.keys(body).length === 0) { return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
          if (body.toggle_only !== undefined) { await env.DB.prepare("UPDATE users SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE username = ?").bind(username).run(); return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } }); }
          else if (body.reset_action !== undefined) {
            if (body.reset_action === "volume") { await env.DB.prepare("UPDATE users SET used_gb = 0, is_active = 1 WHERE username = ?").bind(username).run(); GLOBAL_TRAFFIC_CACHE.set(username, 0); }
            else if (body.reset_action === "req") { await env.DB.prepare("UPDATE users SET used_req = 0, is_active = 1 WHERE username = ?").bind(username).run(); USER_REQ_CACHE.set(username, 0); }
            else if (body.reset_action === "time") { await env.DB.prepare("UPDATE users SET created_at = CURRENT_TIMESTAMP, is_active = 1 WHERE username = ?").bind(username).run(); }
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
          } else {
            const { username: new_username, limit_gb, expiry_days, limit_req, ips, tls, port, fingerprint, ip_limit, block_porn, block_ads, frag_len, frag_int, user_proxy_iata, user_socks5, user_proxy_ip, auto_reset_vol_days, auto_reset_req_days, auto_rotate_ip, rotate_time, ip_operator, ip_count, auto_rotate_user_proxy } = body;
            if (new_username && new_username !== username) {
              if (!/^[a-zA-Z0-9_-]+$/.test(new_username)) { return new Response(JSON.stringify({ error: "نام کاربری جدید غیرمجاز است" }), { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
              const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").bind(new_username).first();
              if (existing) { return new Response(JSON.stringify({ error: "این نام کاربری از قبل وجود دارد" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
              if (GLOBAL_TRAFFIC_CACHE.has(username)) { GLOBAL_TRAFFIC_CACHE.set(new_username, GLOBAL_TRAFFIC_CACHE.get(username)); GLOBAL_TRAFFIC_CACHE.delete(username); }
              if (USER_REQ_CACHE.has(username)) { USER_REQ_CACHE.set(new_username, USER_REQ_CACHE.get(username)); USER_REQ_CACHE.delete(username); }
              if (ACTIVE_CONNECTIONS_COUNT.has(username)) { ACTIVE_CONNECTIONS_COUNT.set(new_username, ACTIVE_CONNECTIONS_COUNT.get(username)); ACTIVE_CONNECTIONS_COUNT.delete(username); }
              if (GLOBAL_LAST_ACTIVE_WRITE.has(username)) { GLOBAL_LAST_ACTIVE_WRITE.set(new_username, GLOBAL_LAST_ACTIVE_WRITE.get(username)); GLOBAL_LAST_ACTIVE_WRITE.delete(username); }
            }
            await env.DB.prepare("UPDATE users SET username = ?, limit_gb = ?, expiry_days = ?, limit_req = ?, ips = ?, tls = ?, port = ?, fingerprint = ?, max_connections = ?, ip_limit = ?, block_porn = ?, block_ads = ?, frag_len = ?, frag_int = ?, user_proxy_iata = ?, user_socks5 = ?, user_proxy_ip = ?, auto_reset_vol_days = ?, auto_reset_req_days = ?, auto_rotate_ip = ?, rotate_time = ?, ip_operator = ?, ip_count = ?, auto_rotate_user_proxy = ? WHERE username = ?").bind(new_username || username, limit_gb ? parseFloat(limit_gb) : null, expiry_days ? parseInt(expiry_days) : null, limit_req ? parseInt(limit_req) : null, ips || null, tls, port, fingerprint || "chrome", ip_limit ? parseInt(ip_limit) : null, ip_limit ? parseInt(ip_limit) : null, block_porn ? 1 : 0, block_ads ? 1 : 0, frag_len !== undefined ? frag_len : "200-3000", frag_int !== undefined ? frag_int : "1-2", user_proxy_iata || null, user_socks5 || null, user_proxy_ip || null, auto_reset_vol_days ? parseInt(auto_reset_vol_days) : 0, auto_reset_req_days ? parseInt(auto_reset_req_days) : 0, auto_rotate_ip || 0, rotate_time || 0, ip_operator || "all", ip_count || 20, auto_rotate_user_proxy ? 1 : 0, username).run();
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
          }
        }
        if (request.method === "DELETE") { await env.DB.prepare("DELETE FROM users WHERE username = ?").bind(username).run(); return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } }); }
      } else {
        if (request.method === "GET") {
          try { await flushExpiredTraffic(env); } catch (e) {}
          try {
            const { results } = await env.DB.prepare("SELECT * FROM users ORDER BY id DESC").all();
            const now = Date.now();
            const enrichedUsers = (results || []).map((user) => ({ ...user, is_online: user.last_active && now - user.last_active < 20000 ? 1 : 0, online_count: getActiveIpCount(user.active_ips) }));
            let cfReqs = { today: 0, total: 0 };
            try {
              const liveCf = await getCfUsage(env);
              const todayStr = new Date().toISOString().split("T")[0];
              const dateRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'req_last_date'").first();
              const totalRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'req_total'").first();
              let dbTotal = totalRow ? parseInt(totalRow.value) || 0 : 0;
              let dbToday = 0;
              if (dateRow && dateRow.value === todayStr) { const todayRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'req_today'").first(); dbToday = todayRow ? parseInt(todayRow.value) || 0 : 0; }
              if (liveCf.today > dbToday) { dbToday = liveCf.today; await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('req_today', ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(String(dbToday), String(dbToday)).run(); await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('req_last_date', ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(todayStr, todayStr).run(); }
              if (liveCf.total > dbTotal) { dbTotal = liveCf.total; await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('req_total', ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(String(dbTotal), String(dbTotal)).run(); }
              cfReqs.today = dbToday + GLOBAL_REQ_COUNT;
              cfReqs.total = dbTotal + GLOBAL_REQ_COUNT;
            } catch (e) {}
            return new Response(JSON.stringify({ users: enrichedUsers, serverTime: now, cfRequestsToday: cfReqs.today, cfRequestsTotal: cfReqs.total }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } });
          } catch (dbErr) { return new Response(JSON.stringify({ users: [], serverTime: Date.now(), cfRequestsToday: 0, cfRequestsTotal: 0, error: dbErr.message }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }); }
        }
        if (request.method === "POST") {
          const { username, uuid, limit_gb, expiry_days, limit_req, ips, tls, port, fingerprint, ip_limit, used_gb, used_req, created_at, is_active, block_porn, block_ads, frag_len, frag_int, user_proxy_iata, user_socks5, user_proxy_ip, auto_reset_vol_days, auto_reset_req_days, auto_rotate_ip, rotate_time, ip_operator, ip_count, auto_rotate_user_proxy } = await readJsonBody(request);
          if (!username) { return new Response(JSON.stringify({ error: "نام کاربری اجباری است" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
          if (username.length > 32) { return new Response(JSON.stringify({ error: "نام کاربری نمی‌تواند بیشتر از ۳۲ کاراکتر باشد" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
          if (!/^[a-zA-Z0-9_-]+$/.test(username)) { return new Response(JSON.stringify({ error: "نام کاربری غیرمجاز است (فقط حروف، اعداد، خط تیره و آندرلاین)" }), { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
          let finalUuid = uuid;
          if (!finalUuid) { const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b => b.toString(16).padStart(2, "0")).join(""); finalUuid = \`4d494c49-434f-4e46-4947-\${randomHex}\`; }
          const parsedUsedGb = parseFloat(used_gb);
          const finalUsedGb = !isNaN(parsedUsedGb) ? parsedUsedGb : 0;
          const parsedUsedReq = parseInt(used_req);
          const finalUsedReq = !isNaN(parsedUsedReq) ? parsedUsedReq : 0;
          const finalCreatedAt = created_at || new Date().toISOString();
          const parsedIsActive = parseInt(is_active);
          const finalIsActive = !isNaN(parsedIsActive) ? parsedIsActive : 1;
          const existingUser = await env.DB.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").bind(username).first();
          if (existingUser) { return new Response(JSON.stringify({ error: "این نام کاربری از قبل وجود دارد" }), { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } }); }
          try {
            const todayUtc = Math.floor(Date.now() / 86400000) * 86400000;
            const nowTime = Date.now();
            await env.DB.prepare("INSERT INTO users (username, uuid, limit_gb, expiry_days, limit_req, ips, connection_type, tls, port, fingerprint, max_connections, ip_limit, used_gb, used_req, created_at, is_active, block_porn, block_ads, frag_len, frag_int, user_proxy_iata, user_socks5, user_proxy_ip, auto_reset_vol_days, auto_reset_req_days, last_reset_vol_time, last_reset_req_time, auto_rotate_ip, rotate_time, ip_operator, ip_count, last_rotate_time, auto_rotate_user_proxy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(username, finalUuid, limit_gb ? parseFloat(limit_gb) : null, expiry_days ? parseInt(expiry_days) : null, limit_req ? parseInt(limit_req) : null, ips || null, "vless", tls, port, fingerprint || "chrome", ip_limit ? parseInt(ip_limit) : null, ip_limit ? parseInt(ip_limit) : null, finalUsedGb, finalUsedReq, finalCreatedAt, finalIsActive, block_porn ? 1 : 0, block_ads ? 1 : 0, frag_len !== undefined ? frag_len : "200-3000", frag_int !== undefined ? frag_int : "1-2", user_proxy_iata || null, user_socks5 || null, user_proxy_ip || null, auto_reset_vol_days ? parseInt(auto_reset_vol_days) : 0, auto_reset_req_days ? parseInt(auto_reset_req_days) : 0, todayUtc, todayUtc, auto_rotate_ip || 0, rotate_time || 0, ip_operator || "all", ip_count || 20, nowTime, auto_rotate_user_proxy ? 1 : 0).run();
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
          } catch (err) { return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } }); }
        }
      }
    }
    return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  },
};
let schemaEnsured = false;
let schemaPromise = null;
let cachedPanelPassword = null;
const DbService = {
  async ensureSchema(db) {
    if (schemaEnsured) return;
    if (schemaPromise) { await schemaPromise; return; }
    schemaPromise = (async () => {
      try { await db.prepare(\`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, uuid TEXT, limit_gb REAL, expiry_days INTEGER, ips TEXT, connection_type TEXT, tls TEXT, port INTEGER, used_gb REAL DEFAULT 0, is_active INTEGER DEFAULT 1, last_active INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)\`).run(); } catch (e) {}
      try { await db.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)").run(); } catch (e) {}
      try {
        const { results } = await db.prepare("PRAGMA table_info(users)").all();
        const existingCols = new Set((results || []).map((r) => r.name));
        const colsToAdd = [
          { name: "is_active", def: "INTEGER DEFAULT 1" }, { name: "last_active", def: "INTEGER" }, { name: "fingerprint", def: "TEXT DEFAULT 'chrome'" }, { name: "max_connections", def: "INTEGER" }, { name: "limit_req", def: "INTEGER" }, { name: "used_req", def: "INTEGER DEFAULT 0" }, { name: "ip_limit", def: "INTEGER DEFAULT NULL" }, { name: "active_ips", def: "TEXT DEFAULT NULL" }, { name: "block_porn", def: "INTEGER DEFAULT 0" }, { name: "block_ads", def: "INTEGER DEFAULT 0" }, { name: "frag_len", def: "TEXT DEFAULT '200-3000'" }, { name: "frag_int", def: "TEXT DEFAULT '1-2'" }, { name: "lifetime_used_gb", def: "REAL DEFAULT 0" }, { name: "user_proxy_ip", def: "TEXT DEFAULT NULL" }, { name: "user_proxy_iata", def: "TEXT DEFAULT NULL" }, { name: "user_socks5", def: "TEXT DEFAULT NULL" }, { name: "auto_reset_vol_days", def: "INTEGER DEFAULT 0" }, { name: "auto_reset_req_days", def: "INTEGER DEFAULT 0" }, { name: "last_reset_vol_time", def: "INTEGER DEFAULT 0" }, { name: "last_reset_req_time", def: "INTEGER DEFAULT 0" }, { name: "auto_rotate_ip", def: "INTEGER DEFAULT 0" }, { name: "rotate_time", def: "INTEGER DEFAULT 0" }, { name: "ip_operator", def: "TEXT DEFAULT 'all'" }, { name: "ip_count", def: "INTEGER DEFAULT 20" }, { name: "last_rotate_time", def: "INTEGER DEFAULT 0" }, { name: "auto_rotate_user_proxy", def: "INTEGER DEFAULT 0" }
        ];
        const stmts = [];
        for (const col of colsToAdd) { if (!existingCols.has(col.name)) { stmts.push(db.prepare(\`ALTER TABLE users ADD COLUMN \${col.name} \${col.def}\`)); } }
        if (stmts.length > 0) { await db.batch(stmts); }
      } catch (e) {}
      try { await db.prepare("UPDATE users SET ip_limit = max_connections WHERE ip_limit IS NULL AND max_connections IS NOT NULL").run(); } catch (e) {}
      try { await db.prepare("UPDATE users SET lifetime_used_gb = used_gb WHERE lifetime_used_gb = 0 OR lifetime_used_gb IS NULL").run(); } catch (e) {}
    })();
    await schemaPromise;
    schemaEnsured = true;
  },
  async getPanelPassword(db) {
    if (cachedPanelPassword !== null) return cachedPanelPassword;
    try { const row = await db.prepare("SELECT value FROM settings WHERE key = 'panel_password'").first(); cachedPanelPassword = row ? row.value : ""; return cachedPanelPassword || null; } catch (e) { return null; }
  },
  async setPanelPassword(db, password) { await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('panel_password', ?)").bind(password).run(); cachedPanelPassword = password; },
  async verifyApiAuth(request, env) {
    const storedPasswordHash = await this.getPanelPassword(env.DB);
    if (!storedPasswordHash) return true;
    const cookies = request.headers.get("Cookie") || "";
    const sessionCookie = cookies.split(";").find((c) => c.trim().startsWith("panel_session="));
    if (!sessionCookie) return false;
    const sessionToken = sessionCookie.split("=")[1].trim();
    return sessionToken === storedPasswordHash;
  },
  async sha256(message) {
    const salt = "MILICONFIG_SECURE_SALT_2026";
    const msgBuffer = new TextEncoder().encode(message + salt);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  },
  async oldSha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  },
};
function getActiveIpCount(activeIpsJson) {
  if (!activeIpsJson) return 0;
  try {
    const activeIps = JSON.parse(activeIpsJson);
    const now = Date.now();
    let count = 0;
    for (const [ip, data] of Object.entries(activeIps)) { const lastSeen = data && typeof data === "object" ? data.timestamp : data; if (now - lastSeen <= 20000) { count++; } }
    return count;
  } catch (e) { return 0; }
}
const SubscriptionService = {
  async generateText(user, host) {
    let ips = [host];
    if (user.ips) { const parsedIps = user.ips.split("\\n").map((ip) => ip.trim()).filter((ip) => ip.length > 0); if (parsedIps.length > 0) ips = parsedIps; }
    const ports = String(user.port || "443").split(",").map((p) => p.trim()).filter((p) => p.length > 0);
    const fp = user.fingerprint || "chrome";
    const dynPath = encodeURIComponent("/stream/MILICONFIG/" + ((user.uuid || "").split("-")[4] || "default"));
    const links = [];
    const m1 = decodeURIComponent("%E2%9A%A0%EF%B8%8F%D9%BE%D9%86%D9%84%20%D8%B1%D8%A7%DB%8C%DA%AF%D8%A7%D9%86%20%D9%88%20%D8%BA%DB%8C%D8%B1%20%D9%82%D8%A7%D8%A8%D9%84%20%D9%81%D8%B1%D9%88%D8%B4%E2%9A%A0%EF%B8%8F");
    const m2 = decodeURIComponent("%F0%9F%9A%80%40MILICONFIG_V2%20%D8%B3%D8%A7%D8%AE%D8%AA%20%D8%B1%D8%A7%DB%8C%DA%AF%D8%A7%D9%86%F0%9F%9A%80");
    links.push("vless://" + user.uuid + "@0.0.0.0:1?encryption=none&security=none&type=ws&host=" + host + "&path=" + dynPath + "#" + encodeURIComponent(m1));
    links.push("vless://" + user.uuid + "@0.0.0.0:1?encryption=none&security=none&type=ws&host=" + host + "&path=" + dynPath + "#" + encodeURIComponent(m2));
    let remVol = "Unlimited";
    if (user.limit_gb) { let rem = user.limit_gb - (user.used_gb || 0); remVol = rem > 0 ? rem.toFixed(2) + "GB" : "0GB"; }
    let remTime = "Unlimited";
    if (user.expiry_days && user.created_at) { const created = new Date(user.created_at); const expiryDate = new Date(created.getTime() + user.expiry_days * 24 * 60 * 60 * 1000); const diffDays = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)); remTime = diffDays > 0 ? diffDays + "Days" : "0Days"; }
    let remReq = "Unlimited";
    if (user.limit_req) { let rem = user.limit_req - (user.used_req || 0); remReq = rem > 0 ? rem.toLocaleString() + "Req" : "0Req"; }
    const infoRemark = "📊 remaining | \\u200E" + remVol + " | \\u200E" + remTime + " | \\u200E" + remReq;
    links.push("vless://" + user.uuid + "@" + host + ":80?path=" + dynPath + "&security=none&encryption=none&host=" + host + "&fp=" + fp + "&type=ws#" + encodeURIComponent(infoRemark));
    const rawPath = "/stream/MILICONFIG/" + ((user.uuid || "").split("-")[4] || "default");
    let proxyList = [];
    try { if (user.user_socks5 && user.user_socks5.trim().startsWith("[")) { proxyList = JSON.parse(user.user_socks5); } else if (user.user_socks5 || user.user_proxy_ip) { proxyList = [user.user_socks5 || user.user_proxy_ip]; } else { proxyList = [null]; } } catch (e) { proxyList = [user.user_socks5 || user.user_proxy_ip]; }
    if (!Array.isArray(proxyList) || proxyList.length === 0) proxyList = [null];
    for (let locIdx = 0; locIdx < proxyList.length; locIdx++) {
      let proxyItem = proxyList[locIdx];
      let proxyStr = typeof proxyItem === "object" && proxyItem !== null ? proxyItem.proxy : proxyItem;
      let countryCode = typeof proxyItem === "object" && proxyItem !== null ? proxyItem.country : (user.user_proxy_iata || "");
      if (!countryCode && proxyStr) {
        try {
          const payload = new TextEncoder().encode("GET /json/?fields=countryCode HTTP/1.1\\r\\nHost: ip-api.com\\r\\nConnection: close\\r\\n\\r\\n");
          const s = await connectProxy(proxyStr, "ip-api.com", 80, payload);
          const reader = s.readable.getReader();
          let resStr = "";
          const dec = new TextDecoder();
          const timeoutId = setTimeout(() => { try { s.close(); } catch(e){} }, 2000);
          try { while (true) { const res = await reader.read(); if (res.done || !res.value) break; resStr += dec.decode(res.value, { stream: true }); if (resStr.includes("countryCode")) break; } }
          finally { clearTimeout(timeoutId); try { s.close(); } catch (e) {} }
          const jsonMatch = resStr.match(/{[^}]"countryCode"\\s*:\\s*"([^"]+)"[^}]*}/);
          if (jsonMatch && jsonMatch[1]) countryCode = jsonMatch[1];
        } catch (e) {}
        if (!countryCode) {
          let ip = "";
          let cleanProxy = proxyStr.replace(/^(socks4|socks5|socks|http|https):\\/\\//i, "");
          let remain = cleanProxy;
          if (remain.includes("@")) remain = remain.substring(remain.lastIndexOf("@") + 1);
          if (remain.startsWith("[")) { ip = remain.substring(1, remain.indexOf("]")); }
          else { const lastColon = remain.lastIndexOf(":"); if (lastColon !== -1 && remain.indexOf(":") === lastColon) ip = remain.substring(0, lastColon); else ip = remain; }
          if (ip) { try { const geoRes = await fetch(\`http://ip-api.com/json/\${ip}?fields=countryCode\`); const geoData = await geoRes.json(); if (geoData && geoData.countryCode) countryCode = geoData.countryCode; } catch (e) {} }
        }
      }
      let flagEmoji = "🌐";
      if (countryCode) { const codePoints = countryCode.toUpperCase().split("").map((char) => 127397 + char.charCodeAt(0)); try { flagEmoji = String.fromCodePoint(...codePoints); } catch (e) {} }
      const currentDynPath = encodeURIComponent(rawPath + ((proxyList[0] !== null && proxyList[0] !== "") ? \`?loc=\${locIdx}\` : ""));
      ips.forEach((ip) => {
        ports.forEach((portStr) => {
          const isTlsPort = TLS_PORTS.has(portStr);
          const tlsVal = isTlsPort ? "tls" : "none";
          const userFrag = user.frag_len && user.frag_int ? "&fragment=" + user.frag_len + "," + user.frag_int : "";
          const remark = "MILICONFIG | " + flagEmoji + " | " + user.username;
          links.push("vless://" + user.uuid + "@" + ip + ":" + portStr + "?path=" + currentDynPath + "&security=" + tlsVal + "&encryption=none&insecure=0&host=" + host + "&fp=" + fp + "&type=ws&allowInsecure=0&sni=" + host + userFrag + "#" + encodeURIComponent(remark));
        });
      });
    }
    const noise = ["# System Update Feed: OK", "# Sync Code: " + Math.random().toString(36).slice(2, 10), "# Version: 2.10.1", "# Description: Secure Node Configurations", ""].join("\\n");
    const plainContent = noise + links.join("\\n");
    const subContent = btoa(unescape(encodeURIComponent(plainContent)));
    const downloadBytes = Math.floor((user.used_gb || 0) * 1073741824);
    const totalBytes = user.limit_gb ? Math.floor(user.limit_gb * 1073741824) : 0;
    let expireTimestamp = 0;
    if (user.expiry_days && user.created_at) { expireTimestamp = Math.floor((new Date(user.created_at).getTime() + user.expiry_days * 86400000) / 1000); }
    const subUserInfo = \`upload=0; download=\${downloadBytes}; total=\${totalBytes}; expire=\${expireTimestamp}\`;
    return new Response(subContent, { headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store", "Subscription-Userinfo": subUserInfo } });
  },
};
async function flushExpiredTraffic(env) {
  const now = Date.now();
  for (const [key, val] of DNS_CACHE.entries()) { if (now > val.expires) DNS_CACHE.delete(key); }
  for (const [ip, record] of LOGIN_ATTEMPTS.entries()) { if (now - record.lastAttempt > 900000) LOGIN_ATTEMPTS.delete(ip); }
  const allUsers = new Set([...GLOBAL_TRAFFIC_CACHE.keys(), ...USER_REQ_CACHE.keys()]);
  for (const uname of allUsers) {
    const cachedBytes = GLOBAL_TRAFFIC_CACHE.get(uname) || 0;
    const cachedReqs = USER_REQ_CACHE.get(uname) || 0;
    const activeCount = ACTIVE_CONNECTIONS_COUNT.get(uname) || 0;
    if (cachedBytes <= 0 && cachedReqs <= 0) { GLOBAL_TRAFFIC_CACHE.delete(uname); USER_REQ_CACHE.delete(uname); if (activeCount <= 0) { GLOBAL_LAST_ACTIVE_WRITE.delete(uname); GLOBAL_LAST_ACTIVE_WRITE.delete(uname + "_hb"); } continue; }
    if (GLOBAL_WRITE_LOCK.get(uname)) continue;
    const lastActive = GLOBAL_LAST_ACTIVE_WRITE.get(uname) || 0;
    if (activeCount <= 0 || now - lastActive > 20000) {
      GLOBAL_WRITE_LOCK.set(uname, true);
      GLOBAL_TRAFFIC_CACHE.set(uname, 0);
      USER_REQ_CACHE.set(uname, 0);
      const deltaGb = cachedBytes / (1024 * 1024 * 1024);
      try { await env.DB.prepare("UPDATE users SET used_gb = used_gb + ?, lifetime_used_gb = lifetime_used_gb + ?, used_req = used_req + ? WHERE username = ?").bind(deltaGb, deltaGb, cachedReqs, uname).run(); }
      catch (e) { console.error(e.message); }
      finally { GLOBAL_WRITE_LOCK.delete(uname); if (activeCount <= 0) { GLOBAL_LAST_ACTIVE_WRITE.delete(uname); GLOBAL_LAST_ACTIVE_WRITE.delete(uname + "_hb"); } }
    }
  }
}
function getSelectedUserProxy(userSocks5, request) {
  if (!userSocks5) return "";
  let proxyList = [];
  try { if (userSocks5.trim().startsWith("[")) { proxyList = JSON.parse(userSocks5); } else { proxyList = [userSocks5]; } } catch (e) { proxyList = [userSocks5]; }
  if (!Array.isArray(proxyList) || proxyList.length === 0) return "";
  let idx = 0;
  if (request) { try { const url = new URL(request.url); const locParam = url.searchParams.get("loc"); if (locParam !== null && !isNaN(locParam)) { idx = parseInt(locParam, 10); } } catch (e) {} }
  const selected = proxyList[idx] || proxyList[0];
  return typeof selected === "object" ? (selected.proxy || "") : String(selected || "");
}
async function handlevIees(env, storedData = null, ctx = null, request = null) {
  let rawClientIP = request ? request.headers.get("CF-Connecting-IP") || "unknown" : "unknown";
  let clientIP = rawClientIP;
  if (rawClientIP !== "unknown") { if (rawClientIP.includes(':')) { const parts = rawClientIP.split(':'); if (parts.length >= 4) { clientIP = parts.slice(0, 4).join(':') + '::/64'; } } else if (rawClientIP.includes('.')) { const parts = rawClientIP.split('.'); if (parts.length === 4) { clientIP = parts.slice(0, 3).join('.') + '.0/24'; } } }
  const socketPair = new WebSocketPair();
  const [clientSock, serverSock] = Object.values(socketPair);
  serverSock.accept();
  serverSock.binaryType = "arraybuffer";
  let username = null;
  let validUUID = null;
  let targetDns = "8.8.4.4";
  let targetDoh = "https://cloudflare-dns.com/dns-query";
  function addBytes(bytes) {
    if (bytes <= 0) return;
    if (!username) { uncountedBytes += bytes; return; }
    if (uncountedBytes > 0) { bytes += uncountedBytes; uncountedBytes = 0; }
    let current = GLOBAL_TRAFFIC_CACHE.get(username) || 0;
    GLOBAL_TRAFFIC_CACHE.set(username, current + bytes);
    GLOBAL_LAST_ACTIVE_WRITE.set(username, Date.now());
    if (GLOBAL_WRITE_LOCK.get(username)) return;
    let lastDbWrite = GLOBAL_LAST_DB_WRITE.get(username) || 0;
    let now = Date.now();
    let thresholdBytes = 50 * 1024 * 1024;
    if ((current >= thresholdBytes && now - lastDbWrite > 10000) || (current > 0 && now - lastDbWrite > 60000)) {
      GLOBAL_WRITE_LOCK.set(username, true);
      let toCommit = GLOBAL_TRAFFIC_CACHE.get(username) || 0;
      let toCommitReq = USER_REQ_CACHE.get(username) || 0;
      if (toCommit <= 0 && toCommitReq <= 0) { GLOBAL_WRITE_LOCK.set(username, false); return; }
      GLOBAL_TRAFFIC_CACHE.set(username, (GLOBAL_TRAFFIC_CACHE.get(username) || 0) - toCommit);
      USER_REQ_CACHE.set(username, (USER_REQ_CACHE.get(username) || 0) - toCommitReq);
      GLOBAL_LAST_DB_WRITE.set(username, now);
      let deltaGb = toCommit / (1024 * 1024 * 1024);
      let writeTask = async () => {
        try { await env.DB.prepare("UPDATE users SET used_gb = used_gb + ?, lifetime_used_gb = lifetime_used_gb + ?, used_req = used_req + ? WHERE username = ?").bind(deltaGb, deltaGb, toCommitReq, username).run(); }
        catch (e) { console.error(e.message); GLOBAL_TRAFFIC_CACHE.set(username, (GLOBAL_TRAFFIC_CACHE.get(username) || 0) + toCommit); USER_REQ_CACHE.set(username, (USER_REQ_CACHE.get(username) || 0) + toCommitReq); }
        finally { GLOBAL_WRITE_LOCK.set(username, false); }
      };
      if (ctx) ctx.waitUntil(writeTask()); else writeTask();
    }
  }
  let isOfflineSet = false;
  let hasCountedAsActive = false;
  const setOffline = () => {
    if (isOfflineSet) return;
    isOfflineSet = true;
    const uname = username;
    if (!uname) return;
    if (clientIP && clientIP !== "unknown" && validUUID) {
      const removeIpTask = async () => {
        try {
          const user = await env.DB.prepare("SELECT active_ips FROM users WHERE uuid = ?").bind(validUUID).first();
          if (user) {
            let activeIps = JSON.parse(user.active_ips || "{}");
            if (activeIps[clientIP]) {
              if (typeof activeIps[clientIP] === "object") { activeIps[clientIP].count = (activeIps[clientIP].count || 1) - 1; if (activeIps[clientIP].count <= 0) { delete activeIps[clientIP]; } }
              else { delete activeIps[clientIP]; }
              await env.DB.prepare("UPDATE users SET active_ips = ? WHERE uuid = ?").bind(JSON.stringify(activeIps), validUUID).run();
            }
          }
        } catch (e) { console.error(\`[setOffline Task] Error: \${e.message}\`); }
      };
      if (ctx) ctx.waitUntil(removeIpTask()); else removeIpTask();
    }
    let activeCount = ACTIVE_CONNECTIONS_COUNT.get(uname) || 0;
    if (hasCountedAsActive) { activeCount = Math.max(0, activeCount - 1); }
    if (activeCount <= 0) {
      ACTIVE_CONNECTIONS_COUNT.delete(uname);
      let cachedBytes = GLOBAL_TRAFFIC_CACHE.get(uname) || 0;
      let cachedReqs = USER_REQ_CACHE.get(uname) || 0;
      if ((cachedBytes > 0 || cachedReqs > 0) && !GLOBAL_WRITE_LOCK.get(uname)) {
        GLOBAL_WRITE_LOCK.set(uname, true);
        GLOBAL_TRAFFIC_CACHE.set(uname, (GLOBAL_TRAFFIC_CACHE.get(uname) || 0) - cachedBytes);
        USER_REQ_CACHE.set(uname, (USER_REQ_CACHE.get(uname) || 0) - cachedReqs);
        const deltaGb = cachedBytes / (1024 * 1024 * 1024);
        const writeTask = async () => {
          try { await env.DB.prepare("UPDATE users SET used_gb = used_gb + ?, lifetime_used_gb = lifetime_used_gb + ?, used_req = used_req + ? WHERE username = ?").bind(deltaGb, deltaGb, cachedReqs, uname).run(); }
          catch (e) { console.error(e.message); GLOBAL_TRAFFIC_CACHE.set(uname, (GLOBAL_TRAFFIC_CACHE.get(uname) || 0) + cachedBytes); USER_REQ_CACHE.set(uname, (USER_REQ_CACHE.get(uname) || 0) + cachedReqs); }
          finally { GLOBAL_WRITE_LOCK.delete(uname); GLOBAL_LAST_ACTIVE_WRITE.delete(uname); }
        };
        if (ctx) { ctx.waitUntil(writeTask()); } else { writeTask(); }
      } else { GLOBAL_LAST_ACTIVE_WRITE.delete(uname); }
    } else { ACTIVE_CONNECTIONS_COUNT.set(uname, activeCount); }
  };
  let heartbeat;
  const runHeartbeat = async () => {
    if (serverSock.readyState === WebSocket.OPEN) {
      try {
        serverSock.send(new Uint8Array(0));
        if (!validUUID || !username) { heartbeat = setTimeout(runHeartbeat, Math.floor(Math.random() * 5000) + 20000); return; }
        const nowTime = Date.now();
        const lastCheck = GLOBAL_LAST_ACTIVE_WRITE.get(username + "_hb") || 0;
        if (nowTime - lastCheck >= 20000) {
          GLOBAL_LAST_ACTIVE_WRITE.set(username + "_hb", nowTime);
          const user = await env.DB.prepare("SELECT is_active, limit_gb, used_gb, limit_req, used_req, expiry_days, created_at, ip_limit, active_ips FROM users WHERE uuid = ?").bind(validUUID).first();
          let isExpired = false;
          let isIpLimitExpired = false;
          let updatedActiveIps = null;
          if (!user || user.is_active === 0) { isExpired = true; }
          else {
            if (user.limit_gb && user.used_gb >= user.limit_gb) isExpired = true;
            if (user.limit_req && user.used_req + (USER_REQ_CACHE.get(username) || 0) >= user.limit_req) isExpired = true;
            if (user.expiry_days && user.created_at) { const expiryDate = new Date(new Date(user.created_at).getTime() + user.expiry_days * 86400000); if (nowTime > expiryDate.getTime()) isExpired = true; }
            if (!isExpired && clientIP && clientIP !== "unknown") {
              let activeIps = {};
              try { activeIps = JSON.parse(user.active_ips || "{}"); } catch (e) {}
              let hasChanges = false;
              for (const [ip, data] of Object.entries(activeIps)) { const lastSeen = data && typeof data === "object" ? data.timestamp : data; if (nowTime - lastSeen > 20000) { delete activeIps[ip]; hasChanges = true; } }
              if (!activeIps[clientIP]) { isIpLimitExpired = true; }
              else {
                const sortedIps = Object.keys(activeIps).sort((a, b) => { const tA = typeof activeIps[a] === "object" ? activeIps[a].timestamp : activeIps[a]; const tB = typeof activeIps[b] === "object" ? activeIps[b].timestamp : activeIps[b]; return tB - tA; });
                if (user.ip_limit && user.ip_limit > 0 && sortedIps.indexOf(clientIP) >= user.ip_limit) isIpLimitExpired = true;
              }
              if (hasChanges || isIpLimitExpired) updatedActiveIps = JSON.stringify(activeIps);
            }
          }
          if (isExpired) { await env.DB.prepare("UPDATE users SET is_active = 0, last_active = 0 WHERE uuid = ?").bind(validUUID).run(); clearTimeout(heartbeat); closeSocketQuietly(serverSock); return; }
          if (isIpLimitExpired) { clearTimeout(heartbeat); closeSocketQuietly(serverSock); return; }
          if (updatedActiveIps !== null) { await env.DB.prepare("UPDATE users SET last_active = ?, active_ips = ? WHERE username = ?").bind(nowTime, updatedActiveIps, username).run(); }
          else { await env.DB.prepare("UPDATE users SET last_active = ? WHERE username = ?").bind(nowTime, username).run(); }
        }
      } catch (e) {}
      heartbeat = setTimeout(runHeartbeat, Math.floor(Math.random() * 5000) + 20000);
    } else { clearTimeout(heartbeat); }
  };
  heartbeat = setTimeout(runHeartbeat, Math.floor(Math.random() * 5000) + 20000);
  let remoteConnWrapper = { socket: null, connectingPromise: null, retryConnect: null };
  let reqUUID = null;
  let isHeaderParsed = false;
  let isHeaderParsing = false;
  let isDnsQuery = false;
  let chunkBuffer = new Uint8Array(0);
  let uncountedBytes = 0;
  let wsChain = Promise.resolve();
  let wsStopped = false, wsFailed = false, wsFinished = false;
  let wsQueueBytes = 0, wsQueueItems = 0;
  let currentSocketWriter = null, activeRemoteWriter = null;
  const releaseRemoteWriter = () => { if (activeRemoteWriter) { try { activeRemoteWriter.releaseLock(); } catch (e) {} activeRemoteWriter = null; } currentSocketWriter = null; };
  const getRemoteWriter = () => { const s = remoteConnWrapper.socket; if (!s) return null; if (s !== currentSocketWriter) { releaseRemoteWriter(); currentSocketWriter = s; activeRemoteWriter = s.writable.getWriter(); } return activeRemoteWriter; };
  const upstreamQueue = createUpstreamQueue({ getWriter: getRemoteWriter, releaseWriter: releaseRemoteWriter, retryConnect: async () => { if (typeof remoteConnWrapper.retryConnect === "function") { await remoteConnWrapper.retryConnect(); } }, closeConnection: () => { try { remoteConnWrapper.socket?.close(); } catch (e) {} closeSocketQuietly(serverSock); }, name: "vIeesWSQueue" });
  const writeToRemote = async (chunk, allowRetry = true) => { return upstreamQueue.writeAndAwait(chunk, allowRetry); };
  const processWsMessage = async (chunk) => {
    const bytes = chunk.byteLength || 0;
    addBytes(bytes);
    if (isDnsQuery) { await forwardvIeesUDP(chunk, serverSock, null, addBytes, targetDns); return; }
    if (isHeaderParsed) { if (remoteConnWrapper.connectingPromise) { await remoteConnWrapper.connectingPromise; } await writeToRemote(chunk); return; }
    if (!isHeaderParsed) {
      chunkBuffer = concatBytes(chunkBuffer, chunk);
      if (chunkBuffer.byteLength < 24) return;
      let optLen = chunkBuffer[17];
      let requiredLen = 18 + optLen + 4;
      if (chunkBuffer.byteLength < requiredLen) return;
      let addrType = chunkBuffer[18 + optLen + 3];
      if (addrType === 1) { requiredLen += 4; }
      else if (addrType === 2) { requiredLen += 1; if (chunkBuffer.byteLength < requiredLen) return; requiredLen += chunkBuffer[18 + optLen + 4]; }
      else if (addrType === 3) { requiredLen += 16; }
      else { serverSock.close(); return; }
      if (chunkBuffer.byteLength < requiredLen) return;
      if (isHeaderParsing) return;
      isHeaderParsing = true;
      reqUUID = extractUUIDFromvIees(chunkBuffer);
      if (!reqUUID) { serverSock.close(); return; }
      let user = null;
      try { user = await env.DB.prepare("SELECT * FROM users WHERE uuid = ?").bind(reqUUID).first(); } catch (e) {}
      if (!user) { serverSock.close(); return; }
      if (request) {
        const reqUrl = new URL(request.url);
        const expectedPath = "/stream/MILICONFIG/" + ((user.uuid || "").split("-")[4] || "default");
        if (reqUrl.pathname !== expectedPath) { serverSock.close(); return; }
      }
      username = user.username;
      validUUID = reqUUID;
      let currentReqs = USER_REQ_CACHE.get(username) || 0;
      USER_REQ_CACHE.set(username, currentReqs + 1);
      if (!GLOBAL_TRAFFIC_CACHE.has(username)) { GLOBAL_TRAFFIC_CACHE.set(username, 0); }
      if (isOfflineSet || serverSock.readyState !== WebSocket.OPEN) { return; }
      if (user.is_active === 0) { serverSock.close(); return; }
      if (user.limit_gb && user.used_gb >= user.limit_gb) { serverSock.close(); return; }
      if (user.limit_req && user.used_req + (USER_REQ_CACHE.get(username) || 0) > user.limit_req) { serverSock.close(); return; }
      if (user.expiry_days && user.created_at) { const created = new Date(user.created_at); const expiryDate = new Date(created.getTime() + user.expiry_days * 24 * 60 * 60 * 1000); if (new Date() > expiryDate) { try { await env.DB.prepare("UPDATE users SET is_active = 0, last_active = 0 WHERE uuid = ?").bind(reqUUID).run(); } catch (e) {} serverSock.close(); return; } }
      if (user.block_porn === 1 && user.block_ads === 1) { targetDns = "94.140.14.15"; targetDoh = "https://family.adguard-dns.com/dns-query"; }
      else if (user.block_porn === 1) { targetDns = "1.1.1.3"; targetDoh = "https://family.cloudflare-dns.com/dns-query"; }
      else if (user.block_ads === 1) { targetDns = "94.140.14.14"; targetDoh = "https://dns.adguard-dns.com/dns-query"; }
      if (clientIP && clientIP !== "unknown") {
        let activeIps = {};
        try { activeIps = JSON.parse(user.active_ips || "{}"); } catch (e) {}
        const now = Date.now();
        for (const [ip, data] of Object.entries(activeIps)) { const lastSeen = data && typeof data === "object" ? data.timestamp : data; if (now - lastSeen > 20000) delete activeIps[ip]; }
        let isNewIp = false;
        if (!activeIps[clientIP]) { const sortedIps = Object.keys(activeIps); if (user.ip_limit && user.ip_limit > 0 && sortedIps.length >= user.ip_limit) { serverSock.close(); return; } activeIps[clientIP] = { timestamp: now, count: 1 }; isNewIp = true; }
        else { if (typeof activeIps[clientIP] === "object") { activeIps[clientIP].timestamp = now; activeIps[clientIP].count = (activeIps[clientIP].count || 0) + 1; } else { activeIps[clientIP] = { timestamp: now, count: 1 }; } }
        const lastWrite = GLOBAL_LAST_ACTIVE_WRITE.get(username) || 0;
        if (isNewIp || (now - lastWrite > 30000)) {
          GLOBAL_LAST_ACTIVE_WRITE.set(username, now);
          const updateTask = async () => { try { await env.DB.prepare("UPDATE users SET active_ips = ?, last_active = ? WHERE uuid = ?").bind(JSON.stringify(activeIps), now, reqUUID).run(); } catch (e) {} };
          if (ctx) ctx.waitUntil(updateTask()); else updateTask();
        }
      }
      isHeaderParsed = true;
      let activeCount = ACTIVE_CONNECTIONS_COUNT.get(username) || 0;
      ACTIVE_CONNECTIONS_COUNT.set(username, activeCount + 1);
      hasCountedAsActive = true;
      if (activeCount === 0) { const setOnlineTask = async () => { try { const now = Date.now(); GLOBAL_LAST_ACTIVE_WRITE.set(username, now); await env.DB.prepare("UPDATE users SET last_active = ? WHERE username = ?").bind(now, username).run(); } catch (e) {} }; if (ctx) ctx.waitUntil(setOnlineTask()); else setOnlineTask(); }
      try {
        let offset = 17;
        const optLen = chunkBuffer[offset++];
        offset += optLen;
        const cmd = chunkBuffer[offset++];
        const port = (chunkBuffer[offset++] << 8) | chunkBuffer[offset++];
        const addrType = chunkBuffer[offset++];
        let addr = "";
        if (addrType === 1) { addr = \`\${chunkBuffer[offset++]}.\${chunkBuffer[offset++]}.\${chunkBuffer[offset++]}.\${chunkBuffer[offset++]}\`; }
        else if (addrType === 2) { const domainLen = chunkBuffer[offset++]; addr = TEXT_DECODER.decode(chunkBuffer.slice(offset, offset + domainLen)); offset += domainLen; }
        else if (addrType === 3) { const v6 = []; for (let i = 0; i < 8; i++) { v6.push(((chunkBuffer[offset++] << 8) | chunkBuffer[offset++]).toString(16)); } addr = v6.join(":"); }
        const rawData = chunkBuffer.slice(offset);
        const respHeader = new Uint8Array([chunkBuffer[0], 0]);
        if ((user.block_ads === 1 || user.block_porn === 1) && addrType === 2 && port !== 53) {
          try {
            const dnsCheck = await dohQuery(addr, "A", targetDoh);
            const isBlocked = dnsCheck.some((r) => r.data === "0.0.0.0" || r.data === "::" || r.data === "176.103.130.130");
            if (isBlocked) { serverSock.close(); return; }
            const resolvedRecord = dnsCheck.find((r) => r.type === 1 || r.type === 28);
            if (resolvedRecord && resolvedRecord.data) { addr = resolvedRecord.data; }
          } catch (e) {}
        }
        if (cmd === 2) { if (port === 53) { isDnsQuery = true; await forwardvIeesUDP(rawData, serverSock, respHeader, addBytes, targetDns); } else { serverSock.close(); } return; }
        if (port === 25 || port === 22 || /^(0.|127.|10.|192.168.|172.(1[6-9]|2[0-9]|3[0-1]).|169.254.|localhost$|::1|::ffff:|fd[0-9a-f]{2}:|fe80:)/i.test(addr)) { serverSock.close(); return; }
        const connectTCP = async (dataPayload = null, useFallback = true) => {
          if (remoteConnWrapper.connectingPromise) { await remoteConnWrapper.connectingPromise; return; }
          const task = (async () => {
            let s = null;
            const socks5 = getSelectedUserProxy(user?.user_socks5, request);
            if (socks5) { try { s = await connectProxy(socks5, addr, port, dataPayload); } catch (proxyErr) { if (user.auto_rotate_user_proxy === 1) { const replaceTask = replaceBrokenProxy(user.username, env, socks5); if (ctx) ctx.waitUntil(replaceTask); else replaceTask.catch(() => {}); } throw proxyErr; } }
            else { s = await connectDirect(addr, port, dataPayload, targetDoh); }
            remoteConnWrapper.socket = s;
            s.closed.catch(() => {}).finally(() => closeSocketQuietly(serverSock));
            connectStreams(s, serverSock, respHeader, null, addBytes);
          })();
          remoteConnWrapper.connectingPromise = task;
          try { await task; } finally { if (remoteConnWrapper.connectingPromise === task) { remoteConnWrapper.connectingPromise = null; } }
        };
        remoteConnWrapper.retryConnect = async () => connectTCP(null, false);
        await connectTCP(rawData, true);
      } catch (e) { serverSock.close(); }
    }
  };
  const handleWsError = (err) => { if (wsFailed) return; wsFailed = true; wsStopped = true; clearTimeout(heartbeat); wsQueueBytes = 0; wsQueueItems = 0; upstreamQueue.clear(); releaseRemoteWriter(); closeSocketQuietly(serverSock); setOffline(); };
  const pushToChain = (task) => { wsChain = wsChain.then(task).catch(handleWsError); };
  serverSock.addEventListener("message", (event) => { if (wsStopped || wsFailed) return; if (typeof event.data === "string") return; const size = event.data.byteLength || 0; const nextBytes = wsQueueBytes + size; const nextItems = wsQueueItems + 1; if (nextBytes > UPSTREAM_QUEUE_MAX_BYTES || nextItems > UPSTREAM_QUEUE_MAX_ITEMS) { handleWsError(new Error("ws queue overflow")); return; } wsQueueBytes = nextBytes; wsQueueItems = nextItems; pushToChain(async () => { wsQueueBytes = Math.max(0, wsQueueBytes - size); wsQueueItems = Math.max(0, wsQueueItems - 1); if (wsFailed) return; await processWsMessage(event.data); }); });
  serverSock.addEventListener("close", () => { clearTimeout(heartbeat); closeSocketQuietly(serverSock); setOffline(); if (wsFinished) return; wsFinished = true; wsStopped = true; pushToChain(async () => { if (wsFailed) return; await upstreamQueue.awaitEmpty(); releaseRemoteWriter(); }); });
  serverSock.addEventListener("error", (err) => { handleWsError(err); });
  return new Response(null, { status: 101, webSocket: clientSock });
}
async function getCfUsage(env) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return { today: 0, total: 0 };
  try {
    const now = new Date();
    const startOfDay = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const q = \`query { viewer { accounts(filter: {accountTag: "\${env.CF_ACCOUNT_ID}"}) { today: workersInvocationsAdaptive(limit: 10, filter: {datetime_geq: "\${startOfDay}"}) { sum { requests } } total: workersInvocationsAdaptive(limit: 10, filter: {datetime_geq: "\${thirtyDaysAgo}"}) { sum { requests } } } } }\`;
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: { Authorization: "Bearer " + env.CF_API_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) });
    const j = await res.json();
    const acc = j?.data?.viewer?.accounts?.[0];
    const todayReqs = acc?.today?.[0]?.sum?.requests || 0;
    const totalReqs = acc?.total?.[0]?.sum?.requests || todayReqs;
    return { today: todayReqs, total: totalReqs };
  } catch (e) { return { today: 0, total: 0 }; }
}
function isIPv4(value) { const parts = String(value || "").split("."); return parts.length === 4 && parts.every((part) => /^\\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255); }
function convertToUint8Array(data) { if (data instanceof Uint8Array) return data; if (data instanceof ArrayBuffer) return new Uint8Array(data); if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength); return new Uint8Array(data || 0); }
function concatBytes(...chunkList) { if (chunkList.length === 2) { const a = convertToUint8Array(chunkList[0]); const b = convertToUint8Array(chunkList[1]); if (!a.byteLength) return b; if (!b.byteLength) return a; const merged = new Uint8Array(a.byteLength + b.byteLength); merged.set(a, 0); merged.set(b, a.byteLength); return merged; } const chunks = chunkList.map(convertToUint8Array); let total = 0; for (const c of chunks) total += c.byteLength; const result = new Uint8Array(total); let offset = 0; for (const c of chunks) { result.set(c, offset); offset += c.byteLength; } return result; }
function closeSocketQuietly(socket) { try { if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CLOSING) { socket.close(); } } catch (e) {} }
async function dohQuery(domain, recordType, targetDoh = DOH_RESOLVER) {
  const cacheKey = \`\${domain}:\${recordType}:\${targetDoh}\`;
  if (DNS_CACHE.has(cacheKey)) { const cached = DNS_CACHE.get(cacheKey); if (Date.now() < cached.expires) return cached.data; DNS_CACHE.delete(cacheKey); }
  try {
    const typeMap = { A: 1, AAAA: 28 };
    const qtype = typeMap[recordType.toUpperCase()] || 1;
    const encodeDomain = (name) => { const parts = name.endsWith(".") ? name.slice(0, -1).split(".") : name.split("."); const bufs = []; for (const label of parts) { const enc = TEXT_ENCODER.encode(label); bufs.push(new Uint8Array([enc.length]), enc); } bufs.push(new Uint8Array([0])); return concatBytes(...bufs); };
    const qname = encodeDomain(domain);
    const query = new Uint8Array(12 + qname.length + 4);
    const qview = new DataView(query.buffer);
    qview.setUint16(0, crypto.getRandomValues(new Uint16Array(1))[0]);
    qview.setUint16(2, 0x0100);
    qview.setUint16(4, 1);
    query.set(qname, 12);
    qview.setUint16(12 + qname.length, qtype);
    qview.setUint16(12 + qname.length + 2, 1);
    const response = await fetch(targetDoh, { method: "POST", headers: { "Content-Type": "application/dns-message", Accept: "application/dns-message" }, body: query });
    if (!response.ok) return [];
    const buf = new Uint8Array(await response.arrayBuffer());
    const dv = new DataView(buf.buffer);
    const qdcount = dv.getUint16(4);
    const ancount = dv.getUint16(6);
    const parseName = (pos) => {
      const labels = [];
      let p = pos, jumped = false, endPos = -1, safe = 128;
      while (p < buf.length && safe-- > 0) {
        const len = buf[p];
        if (len === 0) { if (!jumped) endPos = p + 1; break; }
        if ((len & 0xc0) === 0xc0) { if (!jumped) endPos = p + 2; p = ((len & 0x3f) << 8) | buf[p + 1]; jumped = true; continue; }
        labels.push(TEXT_DECODER.decode(buf.slice(p + 1, p + 1 + len)));
        p += len + 1;
      }
      if (endPos === -1) endPos = p + 1;
      return [labels.join("."), endPos];
    };
    let offset = 12;
    for (let i = 0; i < qdcount; i++) { const [, end] = parseName(offset); offset = Number(end) + 4; }
    const answers = [];
    for (let i = 0; i < ancount && offset < buf.length; i++) {
      const [name, nameEnd] = parseName(offset);
      offset = Number(nameEnd);
      const type = dv.getUint16(offset); offset += 2; offset += 2;
      const ttl = dv.getUint32(offset); offset += 4;
      const rdlen = dv.getUint16(offset); offset += 2;
      const rdata = buf.slice(offset, offset + rdlen); offset += rdlen;
      let data;
      if (type === 1 && rdlen === 4) { data = \`\${rdata[0]}.\${rdata[1]}.\${rdata[2]}.\${rdata[3]}\`; }
      else if (type === 28 && rdlen === 16) { const segs = []; for (let j = 0; j < 16; j += 2) segs.push(((rdata[j] << 8) | rdata[j + 1]).toString(16)); data = segs.join(":"); }
      else { data = Array.from(rdata).map((b) => b.toString(16).padStart(2, "0")).join(""); }
      answers.push({ name, type, TTL: ttl, data });
    }
    if (DNS_CACHE.size >= DNS_CACHE_MAX_ENTRIES) { const oldestKey = DNS_CACHE.keys().next().value; if (oldestKey !== undefined) DNS_CACHE.delete(oldestKey); }
    DNS_CACHE.set(cacheKey, { data: answers, expires: Date.now() + DNS_CACHE_TTL });
    return answers;
  } catch (e) { return []; }
}
function createUpstreamQueue({ getWriter, releaseWriter, retryConnect, closeConnection, name = "UpstreamQueue" }) {
  let chunks = []; let head = 0; let queuedBytes = 0; let draining = false; let closed = false; let bundleBuffer = null; let idleResolvers = []; let activeCompletions = null;
  const settleCompletions = (completions, err = null) => { if (!completions) return; for (const comp of completions) { if (comp) { if (err) comp.reject(err); else comp.resolve(); } } };
  const rejectQueued = (err) => { for (let i = head; i < chunks.length; i++) { const item = chunks[i]; if (item && item.completions) settleCompletions(item.completions, err); } };
  const compact = () => { if (head > 32 && head * 2 >= chunks.length) { chunks = chunks.slice(head); head = 0; } };
  const resolveIdle = () => { if (queuedBytes || draining || !idleResolvers.length) return; const resolvers = idleResolvers; idleResolvers = []; for (const resolve of resolvers) resolve(); };
  const clear = (err = null) => { const closeErr = err || (closed ? new Error(\`\${name}: queue closed\`) : null); if (closeErr) { rejectQueued(closeErr); settleCompletions(activeCompletions, closeErr); activeCompletions = null; } chunks = []; head = 0; queuedBytes = 0; resolveIdle(); };
  const shift = () => { if (head >= chunks.length) return null; const item = chunks[head]; chunks[head++] = undefined; queuedBytes -= item.chunk.byteLength; compact(); return item; };
  const bundle = () => {
    const first = shift();
    if (!first) return null;
    if (head >= chunks.length || first.chunk.byteLength >= UPSTREAM_BUNDLE_TARGET_BYTES) return first;
    let byteLength = first.chunk.byteLength;
    let end = head;
    let allowRetry = first.allowRetry;
    let completions = first.completions || null;
    while (end < chunks.length) {
      const next = chunks[end];
      const nextLength = byteLength + next.chunk.byteLength;
      if (nextLength > UPSTREAM_BUNDLE_TARGET_BYTES) break;
      byteLength = nextLength;
      allowRetry = allowRetry && next.allowRetry;
      if (next.completions) completions = completions ? completions.concat(next.completions) : next.completions;
      end++;
    }
    if (end === head) return first;
    const output = (bundleBuffer ||= new Uint8Array(UPSTREAM_BUNDLE_TARGET_BYTES));
    output.set(first.chunk);
    let offset = first.chunk.byteLength;
    while (head < end) { const next = chunks[head]; chunks[head++] = undefined; queuedBytes -= next.chunk.byteLength; output.set(next.chunk, offset); offset += next.chunk.byteLength; }
    compact();
    return { chunk: output.subarray(0, byteLength), allowRetry, completions };
  };
  const drain = async () => {
    if (draining || closed) return;
    draining = true;
    try {
      let batchCount = 0;
      for (;;) {
        if (closed) break;
        const item = bundle();
        if (!item) break;
        let writer = getWriter();
        if (!writer) throw new Error(\`\${name}: remote writer unavailable\`);
        const completions = item.completions || null;
        activeCompletions = completions;
        try {
          try { await writer.write(item.chunk); }
          catch (err) { releaseWriter?.(); if (!item.allowRetry || typeof retryConnect !== "function") throw err; await retryConnect(); writer = getWriter(); if (!writer) throw err; await writer.write(item.chunk); }
          settleCompletions(completions);
        } catch (err) { settleCompletions(completions, err); throw err; }
        finally { if (activeCompletions === completions) activeCompletions = null; }
        batchCount++;
        if (batchCount >= 16) { await Promise.resolve(); batchCount = 0; }
      }
    } catch (err) { closed = true; clear(err); try { closeConnection?.(err); } catch () {} }
    finally { draining = false; if (!closed && head < chunks.length) queueMicrotask(drain); else resolveIdle(); }
  };
  const enqueue = (data, allowRetry = true, waitForFlush = false) => {
    if (closed) return false;
    if (!getWriter()) return false;
    const chunk = convertToUint8Array(data);
    if (!chunk.byteLength) return true;
    const nextBytes = queuedBytes + chunk.byteLength;
    const nextItems = chunks.length - head + 1;
    if (nextBytes > UPSTREAM_QUEUE_MAX_BYTES || nextItems > UPSTREAM_QUEUE_MAX_ITEMS) { closed = true; const err = Object.assign(new Error(\`\${name}: upload queue overflow (\${nextBytes}B/\${nextItems})\`), { isQueueOverflow: true }); clear(err); try { closeConnection?.(err); } catch () {} throw err; }
    let completionPromise = null;
    let completions = null;
    if (waitForFlush) { completions = []; completionPromise = new Promise((resolve, reject) => completions.push({ resolve, reject })); }
    chunks.push({ chunk, allowRetry, completions });
    queuedBytes = nextBytes;
    if (!draining) queueMicrotask(drain);
    return waitForFlush ? completionPromise.then(() => true) : true;
  };
  return {
    writeAndAwait(data, allowRetry = true) { return enqueue(data, allowRetry, true); },
    async awaitEmpty() { if (!queuedBytes && !draining) return; await new Promise((resolve) => idleResolvers.push(resolve)); },
    clear() { closed = true; clear(); },
  };
}
function createDownstreamSender(webSocket, headerData = null) {
  const MAX_CAP = 128 * 1024;
  const MIN_CAP = 8 * 1024;
  let currentPacketCap = 32 * 1024;
  const tailBytes = 512;
  let header = headerData;
  let pendingBuffer = null;
  let pendingBytes = 0;
  let flushPromise = null;
  let microtaskQueued = false;
  const adjustSmartBuffer = () => { const buffered = webSocket.bufferedAmount || 0; if (buffered > 256 * 1024) { currentPacketCap = Math.max(MIN_CAP, Math.floor(currentPacketCap / 2)); } else if (buffered < 32 * 1024) { currentPacketCap = Math.min(MAX_CAP, currentPacketCap * 2); } };
  const sendRawChunk = async (chunk) => { if (webSocket.readyState !== 1) throw new Error("ws.readyState is not open"); webSocket.send(chunk); };
  const attachResponseHeader = (chunk) => { if (!header) return chunk; const merged = new Uint8Array(header.length + chunk.byteLength); merged.set(header, 0); merged.set(chunk, header.length); header = null; return merged; };
  const flush = async () => { microtaskQueued = false; while (flushPromise) await flushPromise; if (!pendingBytes) return; const output = pendingBuffer.slice(0, pendingBytes); adjustSmartBuffer(); pendingBytes = 0; flushPromise = sendRawChunk(output).finally(() => { flushPromise = null; }); return flushPromise; };
  return {
    async sendDirect(data) { let chunk = convertToUint8Array(data); if (!chunk.byteLength) return; chunk = attachResponseHeader(chunk); await sendRawChunk(chunk); },
    async send(data) {
      let chunk = convertToUint8Array(data);
      if (!chunk.byteLength) return;
      chunk = attachResponseHeader(chunk);
      let offset = 0;
      const totalBytes = chunk.byteLength;
      while (offset < totalBytes) {
        if (!pendingBytes && totalBytes - offset >= currentPacketCap) { const sendBytes = Math.min(currentPacketCap, totalBytes - offset); const view = offset || sendBytes !== totalBytes ? chunk.subarray(offset, offset + sendBytes) : chunk; await sendRawChunk(view); offset += sendBytes; adjustSmartBuffer(); continue; }
        const copyBytes = Math.min(currentPacketCap - pendingBytes, totalBytes - offset);
        if (!pendingBuffer) pendingBuffer = new Uint8Array(MAX_CAP);
        pendingBuffer.set(chunk.subarray(offset, offset + copyBytes), pendingBytes);
        pendingBytes += copyBytes;
        offset += copyBytes;
        if (pendingBytes >= currentPacketCap || currentPacketCap - pendingBytes < tailBytes) { await flush(); }
        else if (!microtaskQueued) { microtaskQueued = true; queueMicrotask(() => { if (pendingBytes) flush().catch(() => closeSocketQuietly(webSocket)); }); }
      }
    },
    flush,
  };
}
async function waitForBackpressure(ws) { if (typeof ws.bufferedAmount === "number") { let maxAttempts = 300; while (ws.bufferedAmount > 512 * 1024 && maxAttempts > 0) { if (ws.readyState !== WebSocket.OPEN) break; await new Promise((r) => setTimeout(r, 5)); maxAttempts--; } } }
async function connectStreams(remoteSocket, webSocket, headerData, retryFunc, onBytes) {
  let header = headerData, hasData = false, reader, useBYOB = false;
  const BYOB_LIMIT = 128 * 1024;
  const downstreamSender = createDownstreamSender(webSocket, header);
  header = null;
  try { reader = remoteSocket.readable.getReader({ mode: "byob" }); useBYOB = true; } catch (e) { reader = remoteSocket.readable.getReader(); }
  try {
    if (!useBYOB) { while (true) { if (webSocket.bufferedAmount > 512 * 1024) await waitForBackpressure(webSocket); const { done, value } = await reader.read(); if (done) break; if (!value || value.byteLength === 0) continue; hasData = true; if (typeof onBytes === "function") onBytes(value.byteLength); await downstreamSender.send(value); } }
    else {
      let readBuffer = new ArrayBuffer(BYOB_LIMIT);
      while (true) {
        if (webSocket.bufferedAmount > 512 * 1024) await waitForBackpressure(webSocket);
        const { done, value } = await reader.read(new Uint8Array(readBuffer, 0, BYOB_LIMIT));
        if (done) break;
        if (!value || value.byteLength === 0) continue;
        hasData = true;
        if (typeof onBytes === "function") onBytes(value.byteLength);
        if (value.byteLength >= DOWNSTREAM_GRAIN_BYTES) { await downstreamSender.flush(); await downstreamSender.sendDirect(value); readBuffer = new ArrayBuffer(BYOB_LIMIT); }
        else { await downstreamSender.send(value); readBuffer = value.buffer.byteLength >= BYOB_LIMIT ? value.buffer : new ArrayBuffer(BYOB_LIMIT); }
      }
    }
    await downstreamSender.flush();
  } catch (err) { closeSocketQuietly(webSocket); }
  finally { try { reader.cancel(); } catch (e) {} try { reader.releaseLock(); } catch (e) {} }
  if (!hasData && retryFunc) await retryFunc();
}
async function connectDirect(address, port, initialData = null, targetDoh = "https://cloudflare-dns.com/dns-query") {
  const socket = connect({ hostname: address, port: port });
  await Promise.race([socket.opened, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000))]);
  if (initialData && initialData.byteLength > 0) { const w = socket.writable.getWriter(); await w.write(convertToUint8Array(initialData)); w.releaseLock(); }
  return socket;
}
async function forwardvIeesUDP(udpChunk, webSocket, respHeader, onBytes, dnsServer = "8.8.4.4") {
  const requestData = convertToUint8Array(udpChunk);
  let tcpSocket = null;
  const abortCtl = new AbortController();
  const timeoutId = setTimeout(() => { try { abortCtl.abort(); } catch (e) {} }, 10000);
  try {
    tcpSocket = connect({ hostname: dnsServer, port: 53 });
    let vIeesHeader = respHeader;
    const writer = tcpSocket.writable.getWriter();
    await writer.write(requestData);
    writer.releaseLock();
    await tcpSocket.readable.pipeTo(new WritableStream({ async write(chunk) { const rawResponse = convertToUint8Array(chunk); if (typeof onBytes === "function") onBytes(rawResponse.byteLength); if (webSocket.readyState !== WebSocket.OPEN) return; if (vIeesHeader) { const merged = new Uint8Array(vIeesHeader.length + rawResponse.byteLength); merged.set(vIeesHeader, 0); merged.set(rawResponse, vIeesHeader.length); webSocket.send(merged.buffer); vIeesHeader = null; } else { webSocket.send(rawResponse); } } }), { signal: abortCtl.signal });
  } catch (e) {}
  finally { clearTimeout(timeoutId); try { if (tcpSocket) tcpSocket.close(); } catch (e) {} }
}
function extractUUIDFromvIees(data) {
  if (data.byteLength < 17) return null;
  const hex = [...data.slice(1, 17)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return \`\${hex.substring(0, 8)}-\${hex.substring(8, 12)}-\${hex.substring(12, 16)}-\${hex.substring(16, 20)}-\${hex.substring(20)}\`;
}
function trackRequest(env, ctx) {
  GLOBAL_REQ_COUNT++;
  const now = Date.now();
  if ((now - GLOBAL_LAST_REQ_WRITE > 900000 || GLOBAL_REQ_COUNT > 5000) && GLOBAL_REQ_COUNT > 0) {
    GLOBAL_LAST_REQ_WRITE = now;
    const countToSave = GLOBAL_REQ_COUNT;
    GLOBAL_REQ_COUNT = 0;
    const task = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('req_total', ?) ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + ?").bind(String(countToSave), String(countToSave)).run();
        const lastDateRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'req_last_date'").first();
        if (!lastDateRow || lastDateRow.value !== today) {
          await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('req_last_date', ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(today, today).run();
          await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('req_today', ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(String(countToSave), String(countToSave)).run();
        } else { await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('req_today', ?) ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + ?").bind(String(countToSave), String(countToSave)).run(); }
      } catch (e) {}
    };
    if (ctx) ctx.waitUntil(task()); else task();
  }
}
async function connectProxy(proxyStr, destAddr, destPort, initialData) {
  let normalized = proxyStr;
  if (proxyStr.includes("t.me/socks") || proxyStr.includes("tg://socks")) {
    const server = proxyStr.match(/server=([^&]+)/)?.[1];
    const port = proxyStr.match(/port=([^&]+)/)?.[1];
    const user = proxyStr.match(/user=([^&]+)/)?.[1];
    const pass = proxyStr.match(/pass=([^&]+)/)?.[1];
    if (server && port) { normalized = user && pass ? \`socks5://\${user}:\${pass}@\${server}:\${port}\` : \`socks5://\${server}:\${port}\`; }
  }
  const isHttp = normalized.toLowerCase().startsWith("http://") || normalized.toLowerCase().startsWith("https://");
  const isSocks4 = normalized.toLowerCase().startsWith("socks4://");
  let cleanStr = normalized.replace(/^(socks4|socks5|socks|http|https):\\/\\//i, "");
  if (isHttp) { return await connectHttp(cleanStr, destAddr, destPort, initialData); }
  if (isSocks4) { return await connectSocks4(cleanStr, destAddr, destPort, initialData); }
  return await connectSocks5(cleanStr, destAddr, destPort, initialData);
}
async function connectSocks4(proxyStr, destAddr, destPort, initialData) {
  const { user, pass, host, port, auth } = parseProxyConfig(proxyStr, 1080);
  const socket = connect({ hostname: host, port: port });
  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  try {
    const portHigh = (destPort >> 8) & 0xff;
    const portLow = destPort & 0xff;
    let req;
    if (isIPv4(destAddr)) { const ipBytes = destAddr.split(".").map(Number); req = new Uint8Array([0x04, 0x01, portHigh, portLow, ipBytes[0], ipBytes[1], ipBytes[2], ipBytes[3], 0x00]); }
    else { const hostBytes = new TextEncoder().encode(destAddr); req = new Uint8Array(9 + hostBytes.length + 1); req[0] = 0x04; req[1] = 0x01; req[2] = portHigh; req[3] = portLow; req[4] = 0x00; req[5] = 0x00; req[6] = 0x00; req[7] = 0x01; req[8] = 0x00; req.set(hostBytes, 9); req[9 + hostBytes.length] = 0x00; }
    await writer.write(req);
    let res = await reader.read();
    if (res.done || !res.value || res.value[0] !== 0x00 || res.value[1] !== 0x5a) { throw new Error("پروکسی SOCKS4 وصل نشد یا اتصال را رد کرد"); }
    if (initialData && initialData.byteLength > 0) { await writer.write(convertToUint8Array(initialData)); }
    writer.releaseLock();
    reader.releaseLock();
    return socket;
  } catch (e) { try { writer.releaseLock(); } catch (err) {} try { reader.releaseLock(); } catch (err) {} try { socket.close(); } catch (err) {} throw e; }
}
function parseProxyConfig(proxyStr, defaultPort) {
  let user = "", pass = "", host = "", port = defaultPort;
  let auth = false, remain = proxyStr;
  if (remain.includes("@")) { const atIdx = remain.lastIndexOf("@"); const authPart = remain.substring(0, atIdx); remain = remain.substring(atIdx + 1); const colonIdx = authPart.indexOf(":"); if (colonIdx !== -1) { user = authPart.substring(0, colonIdx); pass = authPart.substring(colonIdx + 1); } else { user = authPart; } auth = true; }
  if (remain.startsWith("[")) { const closeIdx = remain.indexOf("]"); if (closeIdx !== -1) { host = remain.substring(1, closeIdx); if (remain.length > closeIdx + 1 && remain[closeIdx + 1] === ":") port = parseInt(remain.substring(closeIdx + 2)) || defaultPort; } }
  else { const lastColon = remain.lastIndexOf(":"); if (lastColon !== -1 && remain.indexOf(":") === lastColon) { host = remain.substring(0, lastColon); port = parseInt(remain.substring(lastColon + 1)) || defaultPort; } else { host = remain; } }
  return { user, pass, host, port, auth };
}
async function connectSocks5(socksStr, destAddr, destPort, initialData) {
  const { user, pass, host, port, auth } = parseProxyConfig(socksStr, 1080);
  const socket = connect({ hostname: host, port: port });
  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  try {
    if (auth) { await writer.write(new Uint8Array([0x05, 0x02, 0x00, 0x02])); }
    else { await writer.write(new Uint8Array([0x05, 0x01, 0x00])); }
    let res = await reader.read();
    if (res.done || !res.value || res.value[0] !== 0x05) throw new Error("پاسخ نامعتبر از سرور (پروکسی SOCKS5 نیست یا خاموش است)");
    const method = res.value[1];
    if (method === 0x02) {
      const uEnc = new TextEncoder().encode(user);
      const pEnc = new TextEncoder().encode(pass);
      const authReq = new Uint8Array(1 + 1 + uEnc.length + 1 + pEnc.length);
      authReq[0] = 0x01; authReq[1] = uEnc.length; authReq.set(uEnc, 2); authReq[2 + uEnc.length] = pEnc.length; authReq.set(pEnc, 3 + uEnc.length);
      await writer.write(authReq);
      let authRes = await reader.read();
      if (authRes.done || !authRes.value || authRes.value[1] !== 0x00) throw new Error("نام کاربری یا رمز عبور پروکسی اشتباه است");
    }
    let addrType = 0x03;
    let addrBytes;
    if (isIPv4(destAddr)) { addrType = 0x01; addrBytes = new Uint8Array(destAddr.split(".").map(Number)); }
    else if (destAddr.includes(":")) { addrType = 0x04; addrBytes = new Uint8Array(16); const blocks = destAddr.split(":"); for (let i = 0; i < 8; i++) { const val = parseInt(blocks[i] || "0", 16); addrBytes[i * 2] = (val >> 8) & 0xff; addrBytes[i * 2 + 1] = val & 0xff; } }
    else { const enc = new TextEncoder().encode(destAddr); addrBytes = new Uint8Array(1 + enc.length); addrBytes[0] = enc.length; addrBytes.set(enc, 1); }
    const req = new Uint8Array(4 + addrBytes.length + 2);
    req[0] = 0x05; req[1] = 0x01; req[2] = 0x00; req[3] = addrType; req.set(addrBytes, 4);
    const portOffset = 4 + addrBytes.length;
    req[portOffset] = (destPort >> 8) & 0xff;
    req[portOffset + 1] = destPort & 0xff;
    await writer.write(req);
    let connRes = await reader.read();
    if (connRes.done || !connRes.value || connRes.value[1] !== 0x00) throw new Error("پروکسی وصل شد اما دسترسی به اینترنت آزاد ندارد");
    if (initialData && initialData.byteLength > 0) { await writer.write(convertToUint8Array(initialData)); }
    writer.releaseLock();
    reader.releaseLock();
    return socket;
  } catch (e) { try { writer.releaseLock(); } catch (err) {} try { reader.releaseLock(); } catch (err) {} try { socket.close(); } catch (err) {} throw e; }
}
async function connectHttp(proxyStr, destAddr, destPort, initialData) {
  const { user, pass, host, port, auth } = parseProxyConfig(proxyStr, 80);
  const socket = connect({ hostname: host, port: port });
  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  try {
    const safeDest = destAddr.includes(":") ? \`[\${destAddr}]\` : destAddr;
    let req = \`CONNECT \${safeDest}:\${destPort} HTTP/1.1\\r\\nHost: \${safeDest}:\${destPort}\\r\\n\`;
    if (auth) { const authBase64 = btoa(\`\${user}:\${pass}\`); req += \`Proxy-Authorization: Basic \${authBase64}\\r\\n\`; }
    req += "\\r\\n";
    await writer.write(new TextEncoder().encode(req));
    let resStr = "";
    const dec = new TextDecoder();
    while (true) { const res = await reader.read(); if (res.done || !res.value) throw new Error("proxy_closed"); resStr += dec.decode(res.value, { stream: true }); if (resStr.includes("\\r\\n\\r\\n")) { const match = resStr.match(/^HTTP\\/\\d.\\d\\s+(\\d+)/); if (match && match[1] === "200") { break; } else { throw new Error("proxy_error " + (match ? match[1] : "unknown")); } } }
    if (initialData && initialData.byteLength > 0) { await writer.write(convertToUint8Array(initialData)); }
    writer.releaseLock();
    reader.releaseLock();
    return socket;
  } catch (e) { try { writer.releaseLock(); } catch (err) {} try { reader.releaseLock(); } catch (err) {} try { socket.close(); } catch (err) {} throw e; }
}`;

/* ──────────────────────────────────────────────
   تابع کمکی
────────────────────────────────────────────── */
const rnd = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(3)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/* ──────────────────────────────────────────────
   API: /api/deploy  (Streaming NDJSON)
────────────────────────────────────────────── */
async function handleDeploy(request) {
  let token = "";
  try {
    const body = await request.json();
    token = (body.token || "").trim();
  } catch (_) {}

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      const fail = (msg) => { send({ s: "error", msg }); controller.close(); };

      if (!token) return fail("توکن وارد نشده است.");

      try {
        send({ s: "log", msg: "بررسی اعتبار توکن..." });
        const vr = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", { headers: { Authorization: `Bearer ${token}` } });
        const vd = await vr.json();
        if (!vr.ok || !vd.success) return fail("توکن نامعتبر یا منقضی است.");
        send({ s: "ok", msg: "توکن تأیید شد ✓" });

        send({ s: "log", msg: "دریافت اطلاعات اکانت..." });
        const ar = await fetch("https://api.cloudflare.com/client/v4/accounts?per_page=50", { headers: { Authorization: `Bearer ${token}` } });
        const ad = await ar.json();
        if (!ad.success || !ad.result?.length) return fail("هیچ اکانتی با این توکن یافت نشد.");
        const acc = ad.result[0];
        send({ s: "ok", msg: `اکانت: ${acc.name}` });

        send({ s: "log", msg: "بررسی ساب‌دامین Workers..." });
        const sr = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc.id}/workers/subdomain`, { headers: { Authorization: `Bearer ${token}` } });
        const sd = await sr.json();
        let subdomain = sd.success && sd.result?.subdomain ? sd.result.subdomain : null;
        if (!subdomain) {
          send({ s: "log", msg: "ساب‌دامین وجود ندارد، در حال ساخت..." });
          const desired = "miliconfig-" + rnd();
          const cr = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc.id}/workers/subdomain`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ subdomain: desired }),
          });
          const cd = await cr.json();
          if (!cd.success) return fail("ساخت ساب‌دامین Workers ناموفق بود.");
          subdomain = desired;
        }
        send({ s: "ok", msg: `ساب‌دامین: ${subdomain}.workers.dev` });

        const suffix = rnd();
        const dbName = `miliconfig-db-${suffix}`;
        send({ s: "log", msg: `ساخت دیتابیس D1: ${dbName}` });
        const dr = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc.id}/d1/database`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: dbName }),
        });
        const dd = await dr.json();
        if (!dd.success) return fail("ساخت D1 ناموفق: " + (dd.errors?.[0]?.message || ""));
        const dbId = dd.result.uuid;
        send({ s: "ok", msg: "دیتابیس D1 ساخته شد ✓" });

        send({ s: "log", msg: "پردازش و آماده‌سازی سورس پنل..." });
        const wName = `miliconfig-${suffix}`;
        send({ s: "log", msg: `دیپلوی ورکر: ${wName}` });
        const meta = {
          main_module: "miliconfig.js",
          compatibility_date: "2026-07-10",
          compatibility_flags: ["nodejs_compat"],
          bindings: [{ type: "d1", name: "DB", id: dbId }],
        };
        const fd = new FormData();
        fd.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }), "metadata.json");
        fd.append("miliconfig.js", new Blob([PANEL_SOURCE], { type: "application/javascript+module" }), "miliconfig.js");

        const pr = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc.id}/workers/scripts/${wName}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const pd = await pr.json();
        if (!pr.ok || !pd.success) return fail("دیپلوی ناموفق: " + (pd.errors?.[0]?.message || pr.status));
        send({ s: "ok", msg: "ورکر با موفقیت دیپلوی شد ✓" });

        const url = `https://${wName}.${subdomain}.workers.dev`;
        send({ s: "done", url, worker: wName });
      } catch (e) { return fail("خطای غیرمنتظره: " + e.message); }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache",
    },
  });
}

/* ──────────────────────────────────────────────
   PWA Manifest
────────────────────────────────────────────── */
const PWA_MANIFEST = {
  name: "miliconfigV2",
  short_name: "miliconfigV2",
  description: "ویزارد نصب خودکار پنل miliconfigV2",
  start_url: "/",
  display: "standalone",
  background_color: "#050510",
  theme_color: "#8b5cf6",
  orientation: "portrait-primary",
  icons: [
    {
      src: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcng9IjEyOCIgZmlsbD0iIzhiNWNmNiIvPjx0ZXh0IHg9IjI1NiIgeT0iMzYwIiBmb250LXNpemU9IjMwMCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPuKaoTwvdGV4dD48L3N2Zz4=",
      sizes: "512x512",
      type: "image/svg+xml",
      purpose: "any maskable"
    }
  ]
};

const SW_CODE = `
const CACHE_NAME = 'miliconfigV2-v1';
const ASSETS = ['/'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => { if (e.request.method !== 'GET') return; if (e.request.url.includes('/api/')) return; e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, copy)); return res; }).catch(() => caches.match('/')))); });
`;

const HTML = HTML_CONTENT_PLACEHOLDER;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
    if (url.pathname === "/api/deploy" && request.method === "POST") { return handleDeploy(request); }
    if (url.pathname === "/manifest.json") { return new Response(JSON.stringify(PWA_MANIFEST), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=86400" } }); }
    if (url.pathname === "/sw.js") { return new Response(SW_CODE, { headers: { "Content-Type": "application/javascript", "Cache-Control": "public, max-age=86400" } }); }
    return new Response(HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  },
};
