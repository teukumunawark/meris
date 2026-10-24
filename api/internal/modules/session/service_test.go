package session

import "testing"

func TestCanManageBill(t *testing.T) {
	cases := []struct {
		name         string
		caller       string
		billPayer    string
		sessionPayer string
		want         bool
	}{
		{"bill payer", "Citra", "Citra", "Budi", true},
		{"session payer on another bill", "Budi", "Citra", "Budi", true},
		{"regular participant", "Andi", "Citra", "Budi", false},
		{"name differing only by case", "budi", "Citra", "Budi", false},
		{"trailing space is a different name", "Budi ", "Budi", "Budi", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := canManageBill(tc.caller, tc.billPayer, tc.sessionPayer); got != tc.want {
				t.Errorf("canManageBill(%q, %q, %q) = %v, want %v", tc.caller, tc.billPayer, tc.sessionPayer, got, tc.want)
			}
		})
	}
}
