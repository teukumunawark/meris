-- +goose Up
ALTER TABLE items ADD COLUMN parent_id VARCHAR(50) REFERENCES items(id) ON DELETE CASCADE;

-- +goose Down
ALTER TABLE items DROP COLUMN parent_id;
