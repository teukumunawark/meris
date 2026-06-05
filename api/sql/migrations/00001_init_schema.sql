-- +goose Up
CREATE TABLE sessions (
    id VARCHAR(50) PRIMARY KEY,
    payer_name TEXT NOT NULL,
    payer_bank_name TEXT NOT NULL,
    payer_bank_account TEXT NOT NULL,
    tax DOUBLE PRECISION NOT NULL,
    service_charge DOUBLE PRECISION NOT NULL,
    grand_total DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE participants (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    token VARCHAR(50) NOT NULL,
    CONSTRAINT unique_session_participant_name UNIQUE (session_id, name)
);

CREATE TABLE items (
    id VARCHAR(50) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    quantity INTEGER NOT NULL
);

CREATE TABLE claims (
    id BIGSERIAL PRIMARY KEY,
    item_id VARCHAR(50) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    participant_id BIGINT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    shares DOUBLE PRECISION NOT NULL,
    CONSTRAINT unique_item_participant_claim UNIQUE (item_id, participant_id)
);

-- +goose Down
DROP TABLE claims;
DROP TABLE items;
DROP TABLE participants;
DROP TABLE sessions;
