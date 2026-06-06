package session

import (
	"testing"
)

func TestCalculateProportional(t *testing.T) {
	subtotal := 100000.0
	tax := 11000.0
	service := 5000.0

	personASubtotal := 60000.0
	personBSubtotal := 40000.0

	calcA := CalculateShare(personASubtotal, subtotal, tax, service)
	calcB := CalculateShare(personBSubtotal, subtotal, tax, service)

	expectedA := 60000.0 + (60000.0/100000.0)*(11000.0+5000.0)
	expectedB := 40000.0 + (40000.0/100000.0)*(11000.0+5000.0)

	if calcA.Total != expectedA {
		t.Errorf("Expected A to be %f, got %f", expectedA, calcA.Total)
	}
	if calcB.Total != expectedB {
		t.Errorf("Expected B to be %f, got %f", expectedB, calcB.Total)
	}

	if calcA.Subtotal != personASubtotal {
		t.Errorf("Expected A subtotal to be %f, got %f", personASubtotal, calcA.Subtotal)
	}
}

func TestCalculateProportionalEdgeCases(t *testing.T) {
	tests := []struct {
		name           string
		personSubtotal float64
		subtotal       float64
		tax            float64
		service        float64
		expected       float64
	}{
		{
			name:           "zero subtotal (prevent division by zero)",
			personSubtotal: 10.0,
			subtotal:       0.0,
			tax:            1.0,
			service:        1.0,
			expected:       0.0,
		},
		{
			name:           "negative subtotal",
			personSubtotal: 10.0,
			subtotal:       -100.0,
			tax:            1.0,
			service:        1.0,
			expected:       0.0,
		},
		{
			name:           "negative person subtotal",
			personSubtotal: -10.0,
			subtotal:       100.0,
			tax:            1.0,
			service:        1.0,
			expected:       0.0,
		},
		{
			name:           "negative tax (treated as zero)",
			personSubtotal: 50.0,
			subtotal:       100.0,
			tax:            -10.0,
			service:        10.0,
			expected:       50.0 + (50.0/100.0)*(0.0+10.0), // 50.0 + 5.0 = 55.0
		},
		{
			name:           "negative service (treated as zero)",
			personSubtotal: 50.0,
			subtotal:       100.0,
			tax:            10.0,
			service:        -10.0,
			expected:       50.0 + (50.0/100.0)*(10.0+0.0), // 50.0 + 5.0 = 55.0
		},
		{
			name:           "all zeroes",
			personSubtotal: 0.0,
			subtotal:       0.0,
			tax:            0.0,
			service:        0.0,
			expected:       0.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalculateShare(tt.personSubtotal, tt.subtotal, tt.tax, tt.service)
			if got.Total != tt.expected {
				t.Errorf("CalculateShare(%f, %f, %f, %f).Total = %f; expected %f",
					tt.personSubtotal, tt.subtotal, tt.tax, tt.service, got.Total, tt.expected)
			}
		})
	}
}
