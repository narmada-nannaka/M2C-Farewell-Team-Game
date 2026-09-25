# Runtime image. No npm install, because the server has no dependencies.
FROM node:22-alpine
WORKDIR /app
COPY server.js package.json ./
COPY public ./public
ENV PORT=3000
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "server.js"]
