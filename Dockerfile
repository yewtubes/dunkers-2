FROM node:24-alpine
WORKDIR /app
COPY package.json server.mjs admin.mjs online.mjs characters.mjs ./
COPY public ./public
RUN mkdir storage && chown -R node:node /app
USER node
ENV HOST=0.0.0.0 PORT=8787 DATA_DIR=/app/storage
EXPOSE 8787
VOLUME ["/app/storage"]
CMD ["node", "server.mjs"]
