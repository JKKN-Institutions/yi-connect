# WhatsApp Service Full - 54 Endpoints
# Optimized for Railway deployment

FROM node:20-slim

# Install Chromium dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libnss3 \
    libcups2 \
    libxss1 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm1 \
    fonts-liberation \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    curl \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use the Chromium installed above, and never download its own.
# PUPPETEER_SKIP_CHROMIUM_DOWNLOAD is the LEGACY name — puppeteer dropped it in
# v20 in favour of PUPPETEER_SKIP_DOWNLOAD. whatsapp-web.js@1.34.7 pulls
# puppeteer 24 (PR #875 bumped it from 18), so since that bump only the legacy
# name was set and the image has been downloading a second Chrome-for-Testing at
# build time: slower builds, a much larger image, and it exercises
# @puppeteer/browsers -> extract-zip@2.0.1, which carries two open HIGH advisories
# with NO patched version available. Setting the modern name makes that download —
# and therefore that code path — not happen. Both names are kept so the image
# still behaves if the pinned puppeteer is ever rolled back.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for TypeScript build)
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Remove devDependencies after build to reduce image size
RUN npm prune --production

# Create auth directory for session persistence
RUN mkdir -p .wwebjs_auth && chmod 777 .wwebjs_auth

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start server
CMD ["npm", "start"]
