# نشریار — ایمیج تولید
FROM node:22-alpine

WORKDIR /app

# نصب وابستگی‌ها (لایه جدا تا کش شود)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# کد پروژه و بیلد
COPY . .
RUN npm run build

# پوشه‌های داده (با ولوم بیرونی جایگزین می‌شوند)
RUN mkdir -p /app/data /app/public/uploads

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3100/login || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
