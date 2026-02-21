# Combined Dockerfile for Frontend + Backend in single container
# This runs both Express (frontend) and FastAPI (backend) on one Render service

# Start with Node.js base
FROM node:20-alpine

# Install Python, build dependencies, and CA certificates (required for MongoDB Atlas SSL)
RUN apk add --no-cache \
    python3 \
    py3-pip \
    python3-dev \
    build-base \
    ruby \
    ruby-dev \
    git \
    bash \
    curl \
    ca-certificates \
    openssl

# Update CA certificates
RUN update-ca-certificates

# Create symlinks for python
RUN ln -sf python3 /usr/bin/python

# Install Expo CLI globally
RUN npm install -g expo-cli@latest

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY tsconfig.json ./

# Install Node.js dependencies
RUN npm install

# Copy Python requirements and install
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r backend/requirements.txt

# Copy all source code
COPY . .

# Build Expo web app
RUN npx expo export --platform web

# Copy and set permissions for startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose port (Render sets PORT env var, defaults to 8081)
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health && curl -f http://localhost:${PORT:-8081}/ || exit 1

# Run both servers
CMD ["/app/start.sh"]
