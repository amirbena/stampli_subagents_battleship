# Build stage — compile and package the Spring Boot fat jar
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# Copy pom.xml first so dependency layer is cached unless pom changes
COPY pom.xml .
COPY src ./src
RUN mvn clean install -B --no-transfer-progress

# Run stage — minimal JRE image
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
