package com.stampli.battleship.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    // Uses allowedOriginPatterns instead of allowedOrigins so that wildcard port
    // patterns (e.g. http://localhost:[*]) are supported alongside allowCredentials(true).
    // Spring rejects allowedOrigins("*") with allowCredentials(true) — never use that.
    @Value("${battleship.cors.allowed-origin-pattern}")
    private String allowedOriginPattern;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(allowedOriginPattern)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
