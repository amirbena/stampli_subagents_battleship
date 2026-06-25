package com.stampli.battleship.dto;

/**
 * Request body for {@code POST /players}.
 * <p>
 * Bean Validation annotations are intentionally minimal here — service-level
 * checks in {@code PlayerService} are the authoritative validation source and
 * produce the exact error codes required by the API contract (AC-02–AC-04).
 */
public class CreatePlayerRequest {

    private String displayName;

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }
}
