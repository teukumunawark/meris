package i18n

import (
	"net/http"
	"net/http/httptest"
	"testing"

	i18nPkg "github.com/nicksnyder/go-i18n/v2/i18n"
)

func TestTranslator_Middleware(t *testing.T) {
	translator := NewTranslator()

	handler := translator.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		localizer := GetLocalizer(r.Context())
		if localizer == nil {
			t.Fatal("expected localizer in context, got nil")
		}

		msg, err := localizer.Localize(&i18nPkg.LocalizeConfig{
			MessageID: "errors.unauthorized",
		})
		if err != nil {
			t.Fatalf("failed to localize: %v", err)
		}

		w.Write([]byte(msg))
	}))

	// Test English fallback
	reqEn := httptest.NewRequest("GET", "/", nil)
	reqEn.Header.Set("Accept-Language", "en-US,en;q=0.9")
	wEn := httptest.NewRecorder()
	handler.ServeHTTP(wEn, reqEn)

	expectedEn := "Unauthorized: the token does not match the expected participant."
	if wEn.Body.String() != expectedEn {
		t.Errorf("expected '%s', got '%s'", expectedEn, wEn.Body.String())
	}

	// Test Indonesian
	reqId := httptest.NewRequest("GET", "/", nil)
	reqId.Header.Set("Accept-Language", "id-ID,id;q=0.9")
	wId := httptest.NewRecorder()
	handler.ServeHTTP(wId, reqId)

	expectedId := "Otorisasi gagal: token tidak sesuai dengan partisipan yang diharapkan."
	if wId.Body.String() != expectedId {
		t.Errorf("expected '%s', got '%s'", expectedId, wId.Body.String())
	}
}
