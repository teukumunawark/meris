package session

import "time"

// CompiledClaim is the typed representation of a claim within a compiled session response.
type CompiledClaim struct {
	ID            int64   `json:"id"`
	ItemID        string  `json:"itemId"`
	ParticipantID int64   `json:"participantId"`
	Shares        float64 `json:"shares"`
}

// CompiledItem is the typed representation of an item with its associated claims.
type CompiledItem struct {
	ID        string          `json:"id"`
	SessionID string          `json:"sessionId"`
	Name      string          `json:"name"`
	Price     float64         `json:"price"`
	Quantity  int32           `json:"quantity"`
	Claims    []CompiledClaim `json:"claims"`
}

// CompiledParticipant is the typed representation of a participant with their associated claims.
type CompiledParticipant struct {
	ID        int64           `json:"id"`
	SessionID string          `json:"sessionId"`
	Name      string          `json:"name"`
	Claims    []CompiledClaim `json:"claims"`
}

// CompiledSession is the full, denormalized view of a session returned by GetCompiledSession.
// It is the primary read model used for both the REST response and SSE broadcast payloads.
type CompiledSession struct {
	ID               string                `json:"id"`
	PayerName        string                `json:"payerName"`
	PayerBankName    string                `json:"payerBankName"`
	PayerBankAccount string                `json:"payerBankAccount"`
	Tax              float64               `json:"tax"`
	ServiceCharge    float64               `json:"serviceCharge"`
	GrandTotal       float64               `json:"grandTotal"`
	CreatedAt        string                `json:"createdAt"`
	Items            []CompiledItem        `json:"items"`
	Participants     []CompiledParticipant `json:"participants"`
}

// CreateSessionResult is returned by the CreateSession handler flow.
// It embeds the CompiledSession and optionally includes the payer's identity
// when a payerName was provided at creation time.
type CreateSessionResult struct {
	CompiledSession
	PayerID    *uint   `json:"payerId,omitempty"`
	PayerToken *string `json:"payerToken,omitempty"`
}

// JoinSessionResult is returned when a participant successfully joins a session.
type JoinSessionResult struct {
	ID        int64  `json:"id"`
	SessionID string `json:"sessionId"`
	Name      string `json:"name"`
	Token     string `json:"token"`
}

// ensure time is imported even if only used in CompiledSession.CreatedAt formatting
var _ = time.RFC3339
