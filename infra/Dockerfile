# Combined Dockerfile for the frontend, API, and RAG service

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
COPY apps/frontend/package.json ./apps/frontend/package.json

# Install Node.js dependencies
RUN npm install

# Copy Python requirements and install
COPY apps/api/requirements.txt ./apps/api/requirements.txt
COPY apps/rag-server/requirements.txt ./apps/rag-server/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r apps/api/requirements.txt -r apps/rag-server/requirements.txt

# Copy all source code
COPY . .

# Build the Expo web bundle during image build so startup stays lightweight
RUN npm run build:web --workspace apps/frontend

# Copy and set permissions for startup script
COPY infra/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose port (Render sets PORT env var, defaults to 8081)
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health && curl -f http://localhost:8001/api/health && curl -f http://localhost:${PORT:-8081}/health || exit 1

# Run both servers
CMD ["/app/start.sh"]
