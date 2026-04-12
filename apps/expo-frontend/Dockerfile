FROM node:20-alpine AS build

ARG EXPO_PUBLIC_API_URL=https://skeduleit.onrender.com
ARG EXPO_PUBLIC_FRONTEND_URL=https://skeduleit-front.onrender.com
ARG EXPO_PUBLIC_SCHEDULING_URL=https://skeduleit.onrender.com
ARG EXPO_PUBLIC_MESSAGING_URL=https://skeduleit-messaging.onrender.com
ARG EXPO_PUBLIC_SNAPSHOT_URL=https://skeduleit-snapshots.onrender.com
ARG EXPO_PUBLIC_RAG_URL=https://skeduleit-rag.onrender.com

ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}
ENV EXPO_PUBLIC_FRONTEND_URL=${EXPO_PUBLIC_FRONTEND_URL}
ENV EXPO_PUBLIC_SCHEDULING_URL=${EXPO_PUBLIC_SCHEDULING_URL}
ENV EXPO_PUBLIC_MESSAGING_URL=${EXPO_PUBLIC_MESSAGING_URL}
ENV EXPO_PUBLIC_SNAPSHOT_URL=${EXPO_PUBLIC_SNAPSHOT_URL}
ENV EXPO_PUBLIC_RAG_URL=${EXPO_PUBLIC_RAG_URL}

WORKDIR /app

COPY package*.json ./
COPY apps/expo-frontend/package.json ./apps/expo-frontend/package.json
RUN npm install

COPY . .
RUN npm run build:web --workspace apps/expo-frontend

FROM nginx:1.27-alpine

COPY apps/expo-frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/expo-frontend/dist /usr/share/nginx/html

EXPOSE 8081
