package httprequest

import (
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
)

type QueryParams struct {
	values url.Values
}

func Query(r *http.Request) QueryParams {
	return QueryParams{values: r.URL.Query()}
}

func (q QueryParams) Get(name string) string {
	return q.values.Get(name)
}

func (q QueryParams) Bool(name string, defaultValue bool) (bool, error) {
	raw := q.values.Get(name)
	if raw == "" {
		return defaultValue, nil
	}
	val, err := strconv.ParseBool(raw)
	if err != nil {
		return false, err
	}
	return val, nil
}

func (q QueryParams) Time(name string, layout string) (*time.Time, error) {
	raw := q.values.Get(name)
	if raw == "" {
		return nil, nil
	}
	t, err := time.Parse(layout, raw)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func PathValue(r *http.Request, name string) string {
	return chi.URLParam(r, name)
}
