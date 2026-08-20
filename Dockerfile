FROM node:22-alpine

WORKDIR /app

# Copy package lists
COPY package*.json ./

# Install all dependencies and clean cache to save space
RUN npm install && npm cache clean --force

# Copy source code
COPY . .

# Build production bundle with increased memory limit
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

ARG APP_GIT_SHA=unknown
ARG APP_GIT_BRANCH=main
ENV APP_GIT_SHA=$APP_GIT_SHA
ENV APP_GIT_BRANCH=$APP_GIT_BRANCH

# Expose the port (TanStack Start/Vite defaults to 3000 or 8080 in preview/production)
EXPOSE 3000

# Reconcile and validate the persisted MySQL volume before serving traffic.
# The startup fails closed if the VPS schema cannot reach the canonical contract.
CMD ["npm", "run", "start:production"]
