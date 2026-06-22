package com.stampli.battleship.service;

import org.springframework.http.HttpStatus;

public class GameException extends RuntimeException {
    private final String errorCode;
    private final HttpStatus httpStatus;

    public GameException(String message, String errorCode, HttpStatus httpStatus) {
        super(message);
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public HttpStatus getHttpStatus() {
        return httpStatus;
    }
}
