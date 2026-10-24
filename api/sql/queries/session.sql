-- name: CreateSession :exec
INSERT INTO sessions (id, payer_name, payer_bank_name, payer_bank_account, tax, service_charge, grand_total, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8);

-- name: GetSession :one
SELECT * FROM sessions WHERE id = $1;

-- name: GetSessionForUpdate :one
SELECT * FROM sessions WHERE id = $1 FOR UPDATE;

-- name: CreateItem :exec
INSERT INTO items (id, session_id, bill_id, parent_id, name, price, quantity)
VALUES ($1, $2, $3, $4, $5, $6, $7);

-- name: GetItemsBySession :many
SELECT * FROM items WHERE session_id = $1 ORDER BY id ASC;

-- name: UpdateItemName :exec
UPDATE items SET name = $1 WHERE id = $2 AND session_id = $3;

-- name: UpdateItem :exec
UPDATE items SET name = $1, price = $2, quantity = $3 
WHERE id = $4 AND session_id = $5;

-- name: DeleteItem :exec
DELETE FROM items WHERE id = $1 AND session_id = $2;

-- name: CreateParticipant :one
INSERT INTO participants (session_id, name, token)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetParticipant :one
SELECT * FROM participants WHERE id = $1;

-- name: GetParticipantByName :one
SELECT * FROM participants WHERE session_id = $1 AND name = $2;

-- name: GetParticipantByNameFold :one
-- Case-insensitive lookup so "budi" cannot join next to "Budi"; oldest row wins if old data already has both
SELECT * FROM participants
WHERE session_id = sqlc.arg(session_id) AND lower(name) = lower(sqlc.arg(name)::text)
ORDER BY id LIMIT 1;

-- name: GetParticipantsBySession :many
SELECT * FROM participants WHERE session_id = $1;

-- name: DeleteParticipant :exec
DELETE FROM participants WHERE id = $1 AND session_id = $2;

-- name: CreateClaim :exec
INSERT INTO claims (item_id, participant_id, shares)
VALUES ($1, $2, $3);

-- name: UpdateClaimShares :exec
UPDATE claims SET shares = $1 WHERE item_id = $2 AND participant_id = $3;

-- name: GetClaimByItemAndParticipant :one
SELECT * FROM claims WHERE item_id = $1 AND participant_id = $2;

-- name: DeleteClaim :exec
DELETE FROM claims WHERE item_id = $1 AND participant_id = $2;

-- name: GetClaimsBySession :many
SELECT c.*, p.name as participant_name
FROM claims c
JOIN participants p ON c.participant_id = p.id
WHERE p.session_id = $1;

-- name: GetOtherClaimsSum :one
SELECT COALESCE(SUM(shares), 0.0)::DOUBLE PRECISION
FROM claims
WHERE item_id = $1 AND participant_id != $2;

-- name: UpdateSessionPaymentInfo :exec
UPDATE sessions 
SET payer_bank_name = $1, payer_bank_account = $2 
WHERE id = $3;

-- name: UpdateSessionPayerName :exec
UPDATE sessions 
SET payer_name = $1 
WHERE id = $2;

-- name: CreateBill :exec
INSERT INTO bills (id, session_id, payer_name, name, tax, service_charge, discount, other_charges, grand_total, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);

-- name: GetBillsBySession :many
SELECT * FROM bills WHERE session_id = $1 ORDER BY created_at ASC;

-- name: UpdateBill :exec
UPDATE bills
SET payer_name = $1, name = $2, tax = $3, service_charge = $4, discount = $5, other_charges = $6, grand_total = $7
WHERE id = $8 AND session_id = $9;

-- name: UpdateBillPayerName :exec
UPDATE bills
SET payer_name = $1
WHERE id = $2 AND session_id = $3;

-- name: DeleteBill :exec
DELETE FROM bills WHERE id = $1 AND session_id = $2;

-- name: UpdateParticipantBankInfo :exec
UPDATE participants
SET bank_name = $1, bank_account = $2
WHERE id = $3 AND session_id = $4;

-- name: UpdateParticipantName :exec
UPDATE participants
SET name = $1
WHERE id = $2 AND session_id = $3;

-- name: RenameSessionPayer :exec
UPDATE sessions
SET payer_name = sqlc.arg(new_name)
WHERE id = sqlc.arg(session_id) AND payer_name = sqlc.arg(old_name);

-- name: RenameBillsPayer :exec
UPDATE bills
SET payer_name = sqlc.arg(new_name)
WHERE session_id = sqlc.arg(session_id) AND payer_name = sqlc.arg(old_name);
