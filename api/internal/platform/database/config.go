package database

import (
	"fmt"
	"net/url"
	"strconv"
	"time"
)

type Config struct {
	Host              string
	Port              string
	User              string
	Password          string
	Name              string
	Schema            string
	SSLMode           string
	MaxConns          int32
	MinConns          int32
	MaxConnLifetime   time.Duration
	MaxConnIdleTime   time.Duration
	HealthCheckPeriod time.Duration
	ConnectTimeout    time.Duration
}

func (c Config) DSN() string {
	values := url.Values{}
	values.Set("sslmode", c.SSLMode)
	values.Set("connect_timeout", strconv.Itoa(int(c.ConnectTimeout/time.Second)))
	if c.Schema != "" {
		values.Set("search_path", c.Schema)
	}

	dsn := &url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(c.User, c.Password),
		Host:     fmt.Sprintf("%s:%s", c.Host, c.Port),
		Path:     c.Name,
		RawQuery: values.Encode(),
	}

	return dsn.String()
}
