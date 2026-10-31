package session

import (
	"testing"

	"meris-backend/internal/platform/ai"
)

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

func TestOCRMetadataOf(t *testing.T) {
	raw, model, status := ocrMetadataOf(nil, true)
	if raw != nil || model != "manual" || status != "manual_fallback" {
		t.Fatalf("expected manual fallback metadata, got raw=%v model=%q status=%q", raw, model, status)
	}

	raw, model, status = ocrMetadataOf(&ai.ExtractedReceipt{
		MerchantName:        "Warung Padang",
		GrandTotal:          50000,
		ExtractedByModel:    "ag/gemini-3.8-flash-low",
		MatchesPrintedTotal: true,
	}, false)
	if len(raw) == 0 || model != "ag/gemini-3.8-flash-low" || status != "success" {
		t.Fatalf("unexpected success metadata: model=%q status=%q", model, status)
	}

	_, _, mismatchStatus := ocrMetadataOf(&ai.ExtractedReceipt{
		MerchantName:        "Warung Padang",
		GrandTotal:          50000,
		ExtractedByModel:    "ag/gemini-3.8-flash-high",
		MatchesPrintedTotal: false,
	}, false)
	if mismatchStatus != "reconciled_mismatch" {
		t.Fatalf("expected reconciled_mismatch status, got %q", mismatchStatus)
	}
}
