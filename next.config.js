/** @type {import('next').NextConfig} */

// Content-Security-Policy pragmática para App Router (Next 16).
// - script/style con 'unsafe-inline' porque Next inyecta scripts de hidratación
//   y estilos inline sin nonce (se puede endurecer luego con nonces vía middleware).
// - connect-src limitado a la propia app y a Supabase (auth + realtime).
// - img-src permite https: porque los avatares vienen de varios hosts de Google.
// - frame-ancestors 'none' + X-Frame-Options bloquean clickjacking.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
