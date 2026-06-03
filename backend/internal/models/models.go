package models

import (
	"time"
)

type Session struct {
	ID            string    `gorm:"primaryKey;type:varchar(50)" json:"id"`
	PayerName        string    `json:"payerName"`
	PayerBankName    string    `json:"payerBankName"`
	PayerBankAccount string    `json:"payerBankAccount"`
	Tax              float64   `json:"tax"`
	ServiceCharge float64   `json:"serviceCharge"`
	GrandTotal    float64   `json:"grandTotal"`
	CreatedAt     time.Time `json:"createdAt"`
	Items         []Item    `gorm:"foreignKey:SessionID" json:"items"`
	Participants  []Participant `gorm:"foreignKey:SessionID" json:"participants"`
}

type Participant struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	SessionID string `gorm:"index;type:varchar(50)" json:"sessionId"`
	Name      string `json:"name"`
	Token     string `gorm:"type:varchar(50)" json:"-"`
	Claims    []Claim `gorm:"foreignKey:ParticipantID" json:"claims"`
}

type Item struct {
	ID        string  `gorm:"primaryKey;type:varchar(50)" json:"id"`
	SessionID string  `gorm:"index;type:varchar(50)" json:"sessionId"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Quantity  int     `json:"quantity"`
	Claims    []Claim `gorm:"foreignKey:ItemID" json:"claims"`
}

type Claim struct {
	ID            uint        `gorm:"primaryKey" json:"id"`
	ItemID        string      `gorm:"index;type:varchar(50)" json:"itemId"`
	ParticipantID uint        `gorm:"index" json:"participantId"`
	Participant   Participant `gorm:"foreignKey:ParticipantID" json:"participant"`
	Shares        float64     `json:"shares"`
}
