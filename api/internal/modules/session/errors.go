package session

import "errors"

var (
	// ErrUnauthorized is returned when a token does not match the expected participant.
	ErrUnauthorized = errors.New("unauthorized")

	// ErrNameConflict is returned when a participant name is already taken in the session.
	ErrNameConflict = errors.New("participant name already taken in this session")

	// ErrQuantityExceeded is returned when claimed shares exceed the item quantity.
	ErrQuantityExceeded = errors.New("claimed shares exceed available item quantity")

	// ErrItemNotFound is returned when an item ID does not exist within the session.
	ErrItemNotFound = errors.New("item not found")
)
