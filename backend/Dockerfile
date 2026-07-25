FROM node:20-alpine
WORKDIR /usr/src/app

ENV NODE_ENV=production

# `npm ci` installs the locked tree exactly; `--omit=dev` keeps vitest and
# supertest out of the runtime image.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# The cache snapshot and the JSON store are written here, so the runtime user
# needs to own it. `node` is an unprivileged user shipped with the base image.
ENV DATA_DIR=/data
RUN mkdir -p /data && chown -R node:node /data /usr/src/app
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -q -O /dev/null http://127.0.0.1:3001/api/health || exit 1

# Run node directly (not via npm) so SIGTERM reaches the process and the
# graceful shutdown in server.js can snapshot the cache before exiting.
CMD ["node", "server.js"]
