# =============================================================================
# E2D Connect Gateway — Multi-stage Dockerfile (Audit Fix #48 / P3)
# =============================================================================
# Build the Vite SPA with Bun, then serve the static `dist/` folder with
# Nginx (alpine). Final image is ~25 MB.
# =============================================================================

# ---------- Stage 1: build ----------
FROM oven/bun:1.1.42-alpine AS build

WORKDIR /app

# Cache deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build with build-time env vars (passed via --build-arg or .env.docker)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SENTRY_DSN
ARG VITE_CAPTCHA_SITE_KEY

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_CAPTCHA_SITE_KEY=$VITE_CAPTCHA_SITE_KEY

RUN bun run build

# ---------- Stage 2: serve ----------
FROM nginx:1.27-alpine AS runtime

# Replace default config with SPA-aware one (try_files → index.html)
RUN printf 'server {\n\
  listen 80;\n\
  server_name _;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
\n\
  # Gzip\n\
  gzip on;\n\
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;\n\
  gzip_min_length 1024;\n\
\n\
  # Security headers\n\
  add_header X-Frame-Options "DENY" always;\n\
  add_header X-Content-Type-Options "nosniff" always;\n\
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;\n\
  add_header Permissions-Policy "camera=(), microphone=(), geolocation()" always;\n\
  add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;\n\
\n\
  # Static assets (immutable cache)\n\
  location /assets/ {\n\
    expires 1y;\n\
    add_header Cache-Control "public, immutable";\n\
  }\n\
\n\
  # SPA fallback\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
\n\
  # Health check\n\
  location = /healthz {\n\
    access_log off;\n\
    return 200 "ok\\n";\n\
    add_header Content-Type text/plain;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

# Remove default nginx config that conflicts
RUN rm -f /etc/nginx/conf.d/default.conf.bak

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
