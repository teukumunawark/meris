package session

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"meris-backend/internal/modules/session/db"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) WithTx(ctx context.Context, fn func(*db.Queries) error) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	q := db.New(tx)
	if err := fn(q); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *Repository) GetQueries() *db.Queries {
	return db.New(r.pool)
}

// FetchFullSession compiles all database rows into a cohesive Go struct matching OpenAPI specs
func (r *Repository) FetchFullSession(ctx context.Context, sessionID string) (*db.Session, []db.Item, []db.Participant, []db.GetClaimsBySessionRow, error) {
	q := r.GetQueries()

	session, err := q.GetSession(ctx, sessionID)
	if err != nil {
		return nil, nil, nil, nil, err
	}

	items, err := q.GetItemsBySession(ctx, sessionID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, nil, nil, err
	}

	participants, err := q.GetParticipantsBySession(ctx, sessionID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, nil, nil, err
	}

	claims, err := q.GetClaimsBySession(ctx, sessionID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, nil, nil, err
	}

	return &session, items, participants, claims, nil
}
