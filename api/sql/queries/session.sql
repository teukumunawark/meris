-- name: CreateSession :exec
INSERT INTO sessions (id, payer_name, payer_bank_name, payer_bank_account, tax, service_charge, grand_total, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8);

-- name: GetSession :one
SELECT * FROM sessions WHERE id = $1;

-- name: CreateItem :exec
INSERT INTO items (id, session_id, name, price, quantity)
VALUES ($1, $2, $3, $4, $5);

-- name: GetItemsBySession :many
SELECT * FROM items WHERE session_id = $1;

-- name: UpdateItemName :exec
UPDATE items SET name = $1 WHERE id = $2 AND session_id = $3;

-- name: CreateParticipant :one
INSERT INTO participants (session_id, name, token)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetParticipant :one
SELECT * FROM participants WHERE id = $1;

-- name: GetParticipantByName :one
SELECT * FROM participants WHERE session_id = $1 AND name = $2;

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

-- name: GetClaimsBySession :many
SELECT c.*, p.name as participant_name
FROM claims c
JOIN participants p ON c.participant_id = p.id
WHERE p.session_id = $1;

-- name: GetOtherClaimsSum :one
SELECT COALESCE(SUM(shares), 0.0)::DOUBLE PRECISION
FROM claims
WHERE item_id = $1 AND participant_id != $2;
