/** @type {import('next').NextConfig} */

// Content-Security-Policy pragmática para App Router (Next 16).
// - script/style con 'unsafe-inline' porque Next inyecta scripts de hidratación
//   y estilos inline sin nonce (se puede endurecer luego con nonces vía middleware).
// - connect-src limitado a la propia app y a Supabase (auth + realtime).
// - img-src permite https: porque los avatares vienen de varios hosts de Google.
// - frame-ancestors 'none' + X-Frame-Options bloquean clickjacking (que ESTA
//   app sea enmarcada por otras — lo contrario de frame-src, que controla qué
//   puede enmarcar ESTA app).
// - frame-src 'self' blob: — sin `frame-src` explícito, el navegador cae a
//   `default-src 'self'` para decidir qué puede cargar un <iframe>, y 'self'
//   NO cubre el esquema `blob:` (a diferencia de img-src/worker-src, que sí
//   lo listan a propósito). El editor de plantilla 360° (Reportes → Plantilla)
//   muestra la vista en vivo y el PDF real cada uno en un <iframe src="blob:...">
//   generado con URL.createObjectURL — sin esto, ambos quedan bloqueados por
//   CSP en producción (no en dev, donde estos headers no se aplican), con el
//   mensaje de Chrome "Este contenido está bloqueado".
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "frame-ancestors 'none'",
  "form-action 'self' https://*.supabase.co https://accounts.google.com",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // Fuerza HTTPS por 2 años, incluidos subdominios (el dominio ya sirve solo por TLS).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig = {
  output: 'standalone',
  // No revelar el framework en el header `x-powered-by`.
  poweredByHeader: false,
  // puppeteer-core (reportes PDF 360°) usa binarios nativos: debe quedar fuera
  // del bundling de servidor de Next y copiarse tal cual al build standalone.
  serverExternalPackages: ['puppeteer-core'],
  async headers() {
    // Estos headers son solo para producción (HTTPS real). En dev rompen dos cosas:
    // - Strict-Transport-Security queda cacheado por el navegador para "localhost"
    //   y fuerza HTTPS ahí para siempre (ERR_SSL_PROTOCOL_ERROR en cualquier puerto).
    // - La CSP sin 'unsafe-eval' bloquea el runtime de desarrollo (HMR/Turbopack),
    //   dejando la app en blanco.
    if (process.env.NODE_ENV !== 'production') return [];
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
