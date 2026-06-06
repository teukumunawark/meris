package sqlcutil

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func UUID(value string) (pgtype.UUID, error) {
	var id pgtype.UUID
	if err := id.Scan(strings.TrimSpace(value)); err != nil {
		return pgtype.UUID{}, fmt.Errorf("parse uuid %q: %w", value, err)
	}

	return id, nil
}

func NullableUUID(value string) (pgtype.UUID, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return pgtype.UUID{}, nil
	}

	return UUID(trimmed)
}

func UUIDString(value pgtype.UUID) string {
	if !value.Valid {
		return ""
	}

	u, err := uuid.FromBytes(value.Bytes[:])
	if err != nil {
		return ""
	}

	return u.String()
}

func Timestamptz(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{
		Time:  value,
		Valid: true,
	}
}

func NullableTimestamptz(value *time.Time) pgtype.Timestamptz {
	if value == nil {
		return pgtype.Timestamptz{}
	}

	return Timestamptz(*value)
}

func Time(value pgtype.Timestamptz) time.Time {
	if !value.Valid {
		return time.Time{}
	}

	return value.Time
}

func TimePtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}

	t := value.Time
	return &t
}

func Text(value string) pgtype.Text {
	return pgtype.Text{
		String: value,
		Valid:  true,
	}
}

func TextString(value pgtype.Text) string {
	if !value.Valid {
		return ""
	}

	return value.String
}

func NullableInt8(value *int64) pgtype.Int8 {
	if value == nil {
		return pgtype.Int8{}
	}

	return pgtype.Int8{
		Int64: *value,
		Valid: true,
	}
}

func Int8Pointer(value pgtype.Int8) *int64 {
	if !value.Valid {
		return nil
	}

	number := value.Int64
	return &number
}

func NullableInt2(value *int16) pgtype.Int2 {
	if value == nil {
		return pgtype.Int2{}
	}

	return pgtype.Int2{
		Int16: *value,
		Valid: true,
	}
}

func Int2Pointer(value pgtype.Int2) *int16 {
	if !value.Valid {
		return nil
	}

	number := value.Int16
	return &number
}

func NullableInt4(value *int32) pgtype.Int4 {
	if value == nil {
		return pgtype.Int4{}
	}

	return pgtype.Int4{
		Int32: *value,
		Valid: true,
	}
}

func Int4Pointer(value pgtype.Int4) *int32 {
	if !value.Valid {
		return nil
	}

	number := value.Int32
	return &number
}
