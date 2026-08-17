# Multi-stage Dockerfile for CodePilot Backend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build TypeScript
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production

# Copy compiled JavaScript from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["npm", "start"]
