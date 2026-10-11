# syntax=docker/dockerfile:1

# 1. Install every dependency, including dev, to compile the sources.
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
# --ignore-scripts: no git hooks to install here, and no package may run
# arbitrary code during the image build.
RUN npm ci --ignore-scripts

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# 2. Resolve the production dependency tree on its own, so the final image
#    carries no compilers or test tooling.
FROM node:22-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# 3. Runtime: production dependencies, compiled output, unprivileged user.
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# dumb-init reaps zombies and forwards SIGTERM, so shutdown hooks actually run.
RUN apk add --no-cache dumb-init

COPY --chown=node:node package*.json ./
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
