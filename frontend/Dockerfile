# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Take My Interview — frontend (React 19 + craco → nginx)
#
# Stage 1 builds the static bundle with REACT_APP_BACKEND_URL baked in.
# Stage 2 ships only the built assets behind nginx (no node in the runtime image).
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Install deps first for layer caching
COPY package.json package-lock.json* ./
# `npm ci` requires the lockfile; fall back to `npm install` for dev override.
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

# Now copy the rest of the source
COPY . .

# REACT_APP_* env vars are inlined by webpack at build time. The docker-compose
# build arg defaults to the URL the browser will use; override for production.
ARG REACT_APP_BACKEND_URL=http://localhost:8080
ENV REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL}

# `craco build` invokes react-scripts build and emits /app/build
RUN npm run build

# ── Stage 2: serve ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Drop the default nginx site and ship our SPA + reverse-proxy config.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets from the build stage
COPY --from=build /app/build /usr/share/nginx/html

# nginx ships as root by default; this runs the master as root but workers as
# the unprivileged "nginx" user. We also tighten perms on the html dir.
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx \
 && touch /var/run/nginx.pid \
 && chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

# Liveness check — frontend serves index.html on /
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD sh -c "grep -q ':0050 00000000:0000 0A ' /proc/net/tcp || exit 1"

CMD ["nginx", "-g", "daemon off;"]
