// Cardbox Worker: serves the static page and proxies SportsCardsPro so the
// default token (SCP_TOKEN secret) never reaches the browser. A visitor who
// has entered their own token sends it in X-SCP-Token and it is used instead.
const SCP = "https://www.sportscardspro.com/api/";
const ALLOWED = { products: ["q"], product: ["id", "q"] };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    if (url.pathname === "/api/config") {
      return json({ hasDefault: Boolean(env.SCP_TOKEN) });
    }

    const m = /^\/api\/scp\/(products|product)$/.exec(url.pathname);
    if (!m || request.method !== "GET") return json({ status: "error", "error-message": "not found" }, 404);

    const own = (request.headers.get("X-SCP-Token") || "").trim();
    const token = own || env.SCP_TOKEN;
    if (!token) return json({ status: "error", "error-message": "No SportsCardsPro token: add yours in Settings." }, 401);

    const upstream = new URL(SCP + m[1]);
    upstream.searchParams.set("t", token);
    for (const k of ALLOWED[m[1]]) { const v = url.searchParams.get(k); if (v) upstream.searchParams.set(k, v); }

    try {
      const r = await fetch(upstream, { headers: { "User-Agent": "cardbox/1.0" }, cf: { cacheTtl: 300 } });
      const body = await r.text();
      return new Response(body, { status: r.status, headers: { "content-type": "application/json", "cache-control": "private, max-age=300" } });
    } catch (e) {
      return json({ status: "error", "error-message": "SportsCardsPro unreachable" }, 502);
    }
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
