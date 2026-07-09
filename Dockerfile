# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies with a clean, reproducible install
COPY package.json package-lock.json ./
RUN npm ci

# Build-time configuration.
# NOTE: Vite inlines VITE_* variables into the bundle at build time,
# so these must be provided as build args (not runtime env vars).
ARG VITE_API_URL
ARG VITE_APP_NAME="Meeting Planner Admin"
ARG VITE_USE_MOCK_AUTH="false"
ENV VITE_API_URL=$VITE_API_URL \
    VITE_APP_NAME=$VITE_APP_NAME \
    VITE_USE_MOCK_AUTH=$VITE_USE_MOCK_AUTH

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM nginx:1.27-alpine AS runtime

# SPA-aware nginx config (client-side routing fallback + asset caching)
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Basic healthcheck endpoint served by nginx
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
