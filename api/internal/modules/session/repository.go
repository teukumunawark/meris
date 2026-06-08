package session

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"meris-backend/internal/store/sqlc"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) WithTx(ctx context.Context, fn func(*sqlc.Queries) error) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	q := sqlc.New(tx)
	if err := fn(q); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *Repository) GetQueries() *sqlc.Queries {
	return sqlc.New(r.pool)
}

func (r *Repository) FetchFullSession(ctx context.Context, sessionID string) (*sqlc.Session, []sqlc.Item, []sqlc.Participant, []sqlc.GetClaimsBySessionRow, error) {
	q := r.GetQueries()

	session, err := q.GetSession(ctx, sessionID)
	if err != nil {
		return nil, nil, nil, nil, err
	}

	items, err := q.GetItemsBySession(ctx, sessionID)
	if err != nil {
		return nil, nil, nil, nil, err
	}

	participants, err := q.GetParticipantsBySession(ctx, sessionID)
	if err != nil {
		return nil, nil, nil, nil, err
	}

	claims, err := q.GetClaimsBySession(ctx, sessionID)
	if err != nil {
		return nil, nil, nil, nil, err
	}

	return &session, items, participants, claims, nil
}


