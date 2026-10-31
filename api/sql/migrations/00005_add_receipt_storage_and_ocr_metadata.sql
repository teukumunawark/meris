-- +goose Up
ALTER TABLE bills ADD COLUMN image_key TEXT NOT NULL DEFAULT '';
ALTER TABLE bills ADD COLUMN ocr_raw_response JSONB;
ALTER TABLE bills ADD COLUMN ocr_model TEXT NOT NULL DEFAULT '';
ALTER TABLE bills ADD COLUMN ocr_status TEXT NOT NULL DEFAULT 'success';

CREATE TABLE ocr_logs (
    id VARCHAR(50) PRIMARY KEY,
    image_key TEXT NOT NULL,
    image_sha256 VARCHAR(64) NOT NULL,
    session_id VARCHAR(50),
    bill_id VARCHAR(50),
    status TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    raw_response JSONB,
    error_message TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ocr_logs_bill_id ON ocr_logs(bill_id);
CREATE INDEX idx_ocr_logs_image_sha256 ON ocr_logs(image_sha256);

-- +goose Down
DROP INDEX IF EXISTS idx_ocr_logs_image_sha256;
DROP INDEX IF EXISTS idx_ocr_logs_bill_id;
DROP TABLE IF EXISTS ocr_logs;
ALTER TABLE bills DROP COLUMN ocr_status;
ALTER TABLE bills DROP COLUMN ocr_model;
ALTER TABLE bills DROP COLUMN ocr_raw_response;
ALTER TABLE bills DROP COLUMN image_key;
