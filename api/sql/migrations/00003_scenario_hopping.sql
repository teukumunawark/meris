-- +goose Up
CREATE TABLE bills (
    id VARCHAR(50) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    payer_name TEXT NOT NULL,
    name TEXT NOT NULL,
    tax DOUBLE PRECISION NOT NULL,
    service_charge DOUBLE PRECISION NOT NULL,
    grand_total DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bills_session_id ON bills(session_id);

ALTER TABLE items ADD COLUMN bill_id VARCHAR(50) REFERENCES bills(id) ON DELETE CASCADE;

CREATE INDEX idx_items_bill_id ON items(bill_id);

-- Indexes on existing foreign keys
CREATE INDEX idx_items_session_id ON items(session_id);
CREATE INDEX idx_items_parent_id ON items(parent_id);
CREATE INDEX idx_claims_participant_id ON claims(participant_id);

-- Add bank details to participants
ALTER TABLE participants ADD COLUMN bank_name TEXT NOT NULL DEFAULT '';
ALTER TABLE participants ADD COLUMN bank_account TEXT NOT NULL DEFAULT '';

-- Migrate existing sessions: create a default bill for each session
INSERT INTO bills (id, session_id, payer_name, name, tax, service_charge, grand_total, created_at)
SELECT id, id, payer_name, 'Initial Stop', tax, service_charge, grand_total, created_at
FROM sessions;

-- Associate existing items with their session's default bill
UPDATE items SET bill_id = session_id;

-- Make bill_id NOT NULL now that it is backfilled
ALTER TABLE items ALTER COLUMN bill_id SET NOT NULL;

-- Migrate existing bank accounts for payers
UPDATE participants p
SET bank_name = s.payer_bank_name, bank_account = s.payer_bank_account
FROM sessions s
WHERE p.session_id = s.id AND p.name = s.payer_name;

-- +goose Down
ALTER TABLE participants DROP COLUMN bank_name;
ALTER TABLE participants DROP COLUMN bank_account;
DROP INDEX IF EXISTS idx_claims_participant_id;
DROP INDEX IF EXISTS idx_items_parent_id;
DROP INDEX IF EXISTS idx_items_session_id;
DROP INDEX IF EXISTS idx_items_bill_id;
ALTER TABLE items DROP COLUMN bill_id;
DROP INDEX IF EXISTS idx_bills_session_id;
DROP TABLE bills;
