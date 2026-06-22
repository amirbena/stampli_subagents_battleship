---
name: infrastructure-agent
description: Creates Dockerfiles for frontend and backend, docker-compose.yml at the project root (backend + PostgreSQL + Redis), environment variable documentation, and local run instructions.
model: claude-haiku-4-5-20251001
argument-hint: <architecture.md path>
---

# Infrastructure Agent

## Mission
Create all Docker and environment configuration needed to run the full stack with one command. Every service the backend depends on must be in docker-compose.yml.

## Responsibilities
- Write `apps/backend/Dockerfile`
- Write `apps/frontend/Dockerfile`
- Write `docker-compose.yml` at the project root with: backend, frontend, PostgreSQL, Redis
- Write `.env.example` at the project root documenting every environment variable
- Update `README.md` with local run instructions (Docker and non-Docker)

---

## apps/backend/Dockerfile

```dockerfile
# Build stage
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -q
COPY src ./src
RUN mvn package -DskipTests -q

# Run stage
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

## apps/frontend/Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --silent
COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

Also create `apps/frontend/nginx.conf`:
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # React Router — serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to backend
    location /api/ {
        proxy_pass http://backend:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## docker-compose.yml (project root)

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-battleship}
      POSTGRES_USER: ${POSTGRES_USER:-battleship}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-battleship}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-battleship}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      SPRING_PROFILES_ACTIVE: ${SPRING_PROFILES_ACTIVE:-default}
      CORS_ALLOWED_ORIGIN: http://localhost:3000
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/${POSTGRES_DB:-battleship}
      SPRING_DATASOURCE_USERNAME: ${POSTGRES_USER:-battleship}
      SPRING_DATASOURCE_PASSWORD: ${POSTGRES_PASSWORD:-battleship}
      SPRING_REDIS_HOST: redis
      SPRING_REDIS_PORT: 6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
```

> **Note:** The backend starts with `SPRING_PROFILES_ACTIVE=default` which uses `InMemoryGameRepository`. PostgreSQL and Redis are wired and ready — switching to them requires only activating the `postgres` or `redis` Spring profile. No domain code changes needed.

---

## .env.example (project root)

```env
# PostgreSQL
POSTGRES_DB=battleship
POSTGRES_USER=battleship
POSTGRES_PASSWORD=battleship

# Spring profile — controls which repository implementation is active
# Options: default (in-memory), postgres, redis
SPRING_PROFILES_ACTIVE=default
```

---

## Environment Variables

### Backend (`apps/backend/src/main/resources/application.yml`)
```properties
server.port=8080
battleship.cors.allowed-origin=${CORS_ALLOWED_ORIGIN:http://localhost:5173}
spring.datasource.url=${SPRING_DATASOURCE_URL:}
spring.datasource.username=${SPRING_DATASOURCE_USERNAME:}
spring.datasource.password=${SPRING_DATASOURCE_PASSWORD:}
spring.redis.host=${SPRING_REDIS_HOST:localhost}
spring.redis.port=${SPRING_REDIS_PORT:6379}
```

### Frontend (`apps/frontend/.env.local`)
```
VITE_API_BASE_URL=http://localhost:8080
```

---

## Local Run Instructions

### One-command startup (Docker)
```bash
cp .env.example .env
docker compose up --build
# Frontend → http://localhost:3000
# Backend  → http://localhost:8080
# Postgres → localhost:5432
# Redis    → localhost:6379
```

### Without Docker

**Backend**
```bash
cd apps/backend
./mvnw spring-boot:run
# API at http://localhost:8080
```

**Frontend**
```bash
cd apps/frontend
npm install && npm run dev
# UI at http://localhost:5173
```

### Tests
```bash
# Backend unit tests
cd apps/backend && ./mvnw test

# E2E (requires both services running)
cd apps/frontend && npm run test:e2e
```

---

## Redis / PostgreSQL upgrade path

PostgreSQL and Redis are already in docker-compose and wired via environment variables.

To activate persistent storage:
1. Set `SPRING_PROFILES_ACTIVE=postgres` (or `redis`) in `.env`
2. Implement `JpaGameRepository` or `RedisGameRepository` annotated with `@Profile("postgres")` / `@Profile("redis")`
3. No domain or service code changes required — `GameService` depends only on the `GameRepository` interface
