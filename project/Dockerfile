# ──────────────────────────────────────────────────────────────
# Stage 1: build the static bundle
# ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite inlines env vars at build time, so the deploy target has to be known
# here: it cannot be injected when the container starts.
#   VITE_API_URL="" → same-origin /api, which the nginx stage below proxies.
ARG VITE_API_URL=""
ARG VITE_SITE_URL=""
ARG VITE_PLAUSIBLE_DOMAIN=""
ARG VITE_PLAUSIBLE_SRC=""
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SITE_URL=$VITE_SITE_URL \
    VITE_PLAUSIBLE_DOMAIN=$VITE_PLAUSIBLE_DOMAIN \
    VITE_PLAUSIBLE_SRC=$VITE_PLAUSIBLE_SRC

RUN npm run build

# ──────────────────────────────────────────────────────────────
# Stage 2: serve it
# ──────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
