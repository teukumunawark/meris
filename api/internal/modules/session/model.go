package session

type CompiledClaim struct {
	ID            int64   `json:"id"`
	ItemID        string  `json:"itemId"`
	ParticipantID int64   `json:"participantId"`
	Name          string  `json:"name"`
	Shares        float64 `json:"shares"`
}

type CompiledItem struct {
	ID        string          `json:"id"`
	SessionID string          `json:"sessionId"`
	BillID    string          `json:"billId"`
	ParentID  *string         `json:"parentId,omitempty"`
	Name      string          `json:"name"`
	Price     float64         `json:"price"`
	Quantity  int32           `json:"quantity"`
	Claims    []CompiledClaim `json:"claims"`
}

type CompiledParticipant struct {
	ID            int64           `json:"id"`
	SessionID     string          `json:"sessionId"`
	Name          string          `json:"name"`
	TotalOwed     float64         `json:"totalOwed"`
	Subtotal      float64         `json:"subtotal"`
	Tax           float64         `json:"tax"`
	ServiceCharge float64         `json:"serviceCharge"`
	BankName      string          `json:"bankName"`
	BankAccount   string          `json:"bankAccount"`
	Claims        []CompiledClaim `json:"claims"`
}

type CompiledBill struct {
	ID            string  `json:"id"`
	SessionID     string  `json:"sessionId"`
	PayerName     string  `json:"payerName"`
	Name          string  `json:"name"`
	Tax           float64 `json:"tax"`
	ServiceCharge float64 `json:"serviceCharge"`
	GrandTotal    float64 `json:"grandTotal"`
	CreatedAt     string  `json:"createdAt"`
}

// BilateralTransfer represents a direct debt between two participants at one bill stop,
// before any debt-simplification is applied. Used by the UI to show the intuitive
// "who owes who per bill" breakdown.
type BilateralTransfer struct {
	From     string  `json:"from"`     // consumer
	To       string  `json:"to"`       // payer (who fronted the bill)
	BillName string  `json:"billName"` // name of the stop
	Amount   float64 `json:"amount"`
}

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
	Bills            []CompiledBill        `json:"bills"`
	Transfers        []Transfer            `json:"transfers"`
	RawDebts         []BilateralTransfer   `json:"rawDebts"` // pre-simplification bilateral debts
}

type CreateSessionResult struct {
	CompiledSession
	PayerID    *uint   `json:"payerId,omitempty"`
	PayerToken *string `json:"payerToken,omitempty"`
}

type JoinSessionResult struct {
	ID        int64  `json:"id"`
	SessionID string `json:"sessionId"`
	Name      string `json:"name"`
	Token     string `json:"token"`
}
