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
	Discount      float64         `json:"discount"`
	OtherCharges  float64         `json:"otherCharges"`
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
	Discount      float64 `json:"discount"`
	OtherCharges  float64 `json:"otherCharges"`
	GrandTotal    float64 `json:"grandTotal"`
	CreatedAt     string  `json:"createdAt"`
}

type BilateralTransfer struct {
	From     string  `json:"from"`
	To       string  `json:"to"`
	BillName string  `json:"billName"`
	Amount   float64 `json:"amount"`
}

type CompiledSession struct {
	ID               string                `json:"id"`
	PayerName        string                `json:"payerName"`
	PayerBankName    string                `json:"payerBankName"`
	PayerBankAccount string                `json:"payerBankAccount"`
	Tax              float64               `json:"tax"`
	ServiceCharge    float64               `json:"serviceCharge"`
	Discount         float64               `json:"discount"`
	OtherCharges     float64               `json:"otherCharges"`
	GrandTotal       float64               `json:"grandTotal"`
	CreatedAt        string                `json:"createdAt"`
	Items            []CompiledItem        `json:"items"`
	Participants     []CompiledParticipant `json:"participants"`
	Bills            []CompiledBill        `json:"bills"`
	Transfers        []Transfer            `json:"transfers"`
	RawDebts         []BilateralTransfer   `json:"rawDebts"`
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
