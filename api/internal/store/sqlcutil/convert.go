package sqlcutil

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

func Timestamptz(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{
		Time:  value,
		Valid: true,
	}
}

func Time(value pgtype.Timestamptz) time.Time {
	if !value.Valid {
		return time.Time{}
	}

	return value.Time
}

func String(v string) pgtype.Text {
	return pgtype.Text{String: v, Valid: v != ""}
}

func TextPtr(v pgtype.Text) *string {
	if !v.Valid {
		return nil
	}
	return &v.String
}
