FROM node:20-slim
WORKDIR /app
COPY artifacts/api-server/dist/index.js .
COPY artifacts/api-server/dist/public ./public
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "index.js"]
