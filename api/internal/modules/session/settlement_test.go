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
				"Alice":   100.0 - 70.0,
				"Bob":     50.0 - 60.0,
				"Charlie": 0.0 - 20.0,
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
		{
			name: "Cent-level debts",
			balances: map[string]float64{
				"Alice": 0.01,
				"Bob":   -0.01,
			},
			expected: []Transfer{
				{From: "Bob", To: "Alice", Amount: 0.01},
			},
		},
		{
			name: "Remainder accumulation (Multi-party)",
			balances: map[string]float64{
				"Alice":   0.03,
				"Bob":     0.03,
				"Charlie": -0.02,
				"David":   -0.04,
			},
			expected: []Transfer{
				{From: "David", To: "Alice", Amount: 0.03},
				{From: "David", To: "Bob", Amount: 0.01},
				{From: "Charlie", To: "Bob", Amount: 0.02},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SimplifyDebts(tt.balances)
			if len(got) != len(tt.expected) {
				t.Errorf("SimplifyDebts() got len %d, want %d (got %v, want %v)", len(got), len(tt.expected), got, tt.expected)
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
