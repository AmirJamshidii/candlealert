FROM node:20-alpine AS builder
ENV NODE_ENV=development
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
ARG PORT=3000
ENV PORT=${PORT}
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps
COPY --from=builder /app/dist ./dist
COPY public ./public
USER node
EXPOSE ${PORT}
CMD ["node", "dist/main"]
