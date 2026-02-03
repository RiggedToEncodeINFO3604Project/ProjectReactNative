# Docker Environment for Expo/React Project

## Quick Start

### Development Mode

1. **Build and start the development container:**

   ```bash
   docker-compose up --build
   ```

2. **Access the Expo development server:**
   - Open your browser to `http://localhost:8081`
   - For web preview: `http://localhost:19000` or `http://localhost:19001`

3. **Stop the containers:**
   ```bash
   docker-compose down
   ```

### Web Preview Mode

Build and run the web preview:

```bash
docker-compose --profile web up --build web-preview
```

## Manual Docker Commands

### Build the image:

```bash
docker build -t expo-app .
```

### Run the container:

```bash
docker run -p 8081:8081 -p 19000:19000 -p 19001:19001 -v .:/app -v /app/node_modules expo-app
```

## Port Reference

| Port  | Service                    |
| ----- | -------------------------- |
| 8081  | Metro Bundler              |
| 19000 | Expo Dev Tools (HTTP)      |
| 19001 | Expo Dev Tools (WebSocket) |
| 3000  | Web Preview                |

## Useful Commands

- **Restart container:** `docker-compose restart`
- **View logs:** `docker-compose logs -f`
- **Remove volumes:** `docker-compose down -v`
- **Install new packages:**
  ```bash
  docker-compose exec expo-app npm install <package-name>
  ```

## Hot Reload

Volume mounting is configured for hot reload. Changes to your source code will be reflected automatically in the running Expo server.

## Troubleshooting

### Metro bundler cache issues

Clear the cache and restart:

```bash
docker-compose exec expo-app npx expo start --clear
```

### Node modules issues

Reinstall dependencies:

```bash
docker-compose down -v
docker-compose up --build
```

### Port already in use

Stop the containers and check for processes using the ports:

```bash
# Windows
netstat -ano | findstr :8081

# Linux/Mac
lsof -i :8081
```
