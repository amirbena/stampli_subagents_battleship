package com.stampli.battleship.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.stream.IntStream;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    // Port range for allowed localhost origins.
    // Only ports in [minPort, maxPort] are permitted — explicit enumeration avoids
    // the open-ended wildcard http://localhost:[*] that accepted any port.
    // Spring permits allowedOrigins(explicit list) with allowCredentials(true);
    // only the literal "*" wildcard is forbidden alongside allowCredentials.
    @Value("${battleship.cors.min-port:3000}")
    private int minPort;

    @Value("${battleship.cors.max-port:3030}")
    private int maxPort;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // Build the explicit origin list at startup so the range is enforced strictly.
        // IntStream.rangeClosed is inclusive on both ends, matching [minPort, maxPort].
        String[] allowedOrigins = IntStream.rangeClosed(minPort, maxPort)
                .mapToObj(port -> "http://localhost:" + port)
                .toArray(String[]::new);

        registry.addMapping("/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
