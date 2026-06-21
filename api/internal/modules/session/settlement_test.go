package session

import (
	"testing"
)

func TestSimplifyDebts(t *testing.T) {
	tests := []struct {
		name     string
		balances map[string]float64
		expected []Transfer
	}{
		{
			name: "Simple transfer",
			balances: map[string]float64{
				"Alice": 50.0,
				"Bob":   -50.0,
			},
			expected: []Transfer{
				{From: "Bob", To: "Alice", Amount: 50.0},
			},
		},
		{
			name: "Three-way circular reduction",
			balances: map[string]float64{
				"Alice":   30.0,  // Paid 100, consumed 70
				"Bob":     -10.0, // Paid 50, consumed 60
				"Charlie": -20.0, // Paid 0, consumed 20
			},
			expected: []Transfer{
				{From: "Charlie", To: "Alice", Amount: 20.0},
				{From: "Bob", To: "Alice", Amount: 10.0},
			},
		},
		{
			name: "No transfers needed",
			balances: map[string]float64{
				"Alice": 0.0,
				"Bob":   0.0,
			},
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SimplifyDebts(tt.balances)
			if len(got) != len(tt.expected) {
				t.Errorf("SimplifyDebts() got len %d, want %d", len(got), len(tt.expected))
				return
			}
			for i := range got {
				if got[i].From != tt.expected[i].From || got[i].To != tt.expected[i].To || got[i].Amount != tt.expected[i].Amount {
					t.Errorf("SimplifyDebts() got[%d] = %v, want %v", i, got[i], tt.expected[i])
				}
			}
		})
	}
}
