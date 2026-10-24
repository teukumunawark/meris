package i18n

import (
	"context"
	"embed"
	"encoding/json"
	"net/http"

	"github.com/nicksnyder/go-i18n/v2/i18n"
	"golang.org/x/text/language"
)

//go:embed locales/*.json
var localesFS embed.FS

type contextKey string

const LocalizerKey contextKey = "localizer"

type Translator struct {
	bundle *i18n.Bundle
}

func NewTranslator() *Translator {
	bundle := i18n.NewBundle(language.English)
	bundle.RegisterUnmarshalFunc("json", json.Unmarshal)

	enBytes, _ := localesFS.ReadFile("locales/en.json")
	idBytes, _ := localesFS.ReadFile("locales/id.json")

	_, _ = bundle.ParseMessageFileBytes(enBytes, "locales/en.json")
	_, _ = bundle.ParseMessageFileBytes(idBytes, "locales/id.json")

	return &Translator{bundle: bundle}
}

func (t *Translator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		accept := r.Header.Get("Accept-Language")
		localizer := i18n.NewLocalizer(t.bundle, accept)
		ctx := context.WithValue(r.Context(), LocalizerKey, localizer)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetLocalizer(ctx context.Context) *i18n.Localizer {
	if localizer, ok := ctx.Value(LocalizerKey).(*i18n.Localizer); ok {
		return localizer
	}
	return nil
}
