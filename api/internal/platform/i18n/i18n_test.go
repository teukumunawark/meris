package i18n

import (
	"encoding/json"
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

		_, _ = w.Write([]byte(msg))
	}))

	reqEn := httptest.NewRequest("GET", "/", nil)
	reqEn.Header.Set("Accept-Language", "en-US,en;q=0.9")
	wEn := httptest.NewRecorder()
	handler.ServeHTTP(wEn, reqEn)

	expectedEn := "You don't have permission to change this."
	if wEn.Body.String() != expectedEn {
		t.Errorf("expected '%s', got '%s'", expectedEn, wEn.Body.String())
	}

	reqId := httptest.NewRequest("GET", "/", nil)
	reqId.Header.Set("Accept-Language", "id-ID,id;q=0.9")
	wId := httptest.NewRecorder()
	handler.ServeHTTP(wId, reqId)

	expectedId := "Kamu tidak punya izin untuk mengubah ini."
	if wId.Body.String() != expectedId {
		t.Errorf("expected '%s', got '%s'", expectedId, wId.Body.String())
	}
}

func TestLocalesDefineTheSameMessages(t *testing.T) {
	load := func(name string) map[string]any {
		raw, err := localesFS.ReadFile("locales/" + name)
		if err != nil {
			t.Fatalf("read %s: %v", name, err)
		}
		var messages map[string]any
		if err := json.Unmarshal(raw, &messages); err != nil {
			t.Fatalf("parse %s: %v", name, err)
		}
		return messages
	}

	en, id := load("en.json"), load("id.json")
	for key := range en {
		if _, ok := id[key]; !ok {
			t.Errorf("%s is missing from id.json", key)
		}
	}
	for key := range id {
		if _, ok := en[key]; !ok {
			t.Errorf("%s is missing from en.json", key)
		}
	}
}
