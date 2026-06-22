package com.stampli.battleship.domain;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.ToString;

@Getter
@RequiredArgsConstructor
@EqualsAndHashCode
@ToString
public final class Coordinate {
    private final int row;
    private final int col;

    public boolean isValid() {
        return row >= 0 && row <= 9 && col >= 0 && col <= 9;
    }
}
