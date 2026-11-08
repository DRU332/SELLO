// SOLO DESARROLLO LOCAL: gateway mínimo con las mismas rutas que Supabase
// (/auth/v1, /rest/v1, /storage/v1) para probar sin la nube.
import http from "node:http";

const routes = [
  ["/auth/v1", Number(process.env.AUTH_PORT || 9999)],
  ["/rest/v1", Number(process.env.REST_PORT || 3001)],
  ["/storage/v1", Number(process.env.STORAGE_PORT || 5000)],
];
const port = Number(process.env.GATEWAY_PORT || 54321);

http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    if (req.method === "OPTIONS") return res.writeHead(204).end();
    const match = routes.find(([prefix]) => req.url.startsWith(prefix));
    if (!match) return res.writeHead(404).end("no route");
    const [prefix, target] = match;
    const proxied = http.request(
      { host: "127.0.0.1", port: target, method: req.method, path: req.url.slice(prefix.length) || "/", headers: req.headers },
      (up) => {
        res.writeHead(up.statusCode || 502, up.headers);
        up.pipe(res);
      },
    );
    proxied.on("error", (e) => res.writeHead(502).end(String(e)));
    req.pipe(proxied);
  })
  .listen(port, () => console.log(`gateway en http://127.0.0.1:${port}`));
