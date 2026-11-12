# ============================================================================
#  Social Stats — frontend image (React build → nginx)
#
#  Build args bake the API/WS endpoints into the CRA bundle. The defaults
#  ("/api", same-origin WS) match docker-compose.yml, where this nginx also
#  proxies /api/, /ws/ and /media/ to the backend service so the whole app
#  is served from one origin.
# ============================================================================
FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
# One-click demo logins on /login. Off unless explicitly built with "true"
# (the CI smoke-test stack does; published images never do).
ARG REACT_APP_SHOW_DEMO=false
ENV REACT_APP_SHOW_DEMO=${REACT_APP_SHOW_DEMO}
RUN CI=true npm run build

# ── Runtime ─────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
