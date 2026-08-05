// Dev-only proxy: a böngésző csak a frontend origin-jével beszél (azonos origin),
// a /api kérések innen továbbítódnak a backendre. Így Codespaces (https forwarded)
// és lokális futtatás esetén sincs CORS / cross-site cookie gond.
// Csak a fejlesztői szerveren (yarn start) fut; a production buildet nem érinti.
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  const target = process.env.BACKEND_PROXY || "http://localhost:8001";
  app.use(
    "/api",
    createProxyMiddleware({
      target,
      changeOrigin: true,
    })
  );
};
