package com.stampli.battleship.dto;

public class ErrorResponse {
    private final String error;
    private final String code;

    public ErrorResponse(String error, String code) {
        this.error = error;
        this.code = code;
    }

    public String getError() {
        return error;
    }

    public String getCode() {
        return code;
    }
}
