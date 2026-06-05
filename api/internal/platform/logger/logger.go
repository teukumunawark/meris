package logger

import (
	"log/slog"

	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/otel/exporters/stdout/stdoutlog"
	"go.opentelemetry.io/otel/log/global"
	sdklog "go.opentelemetry.io/otel/sdk/log"
)

func Init(env, level string) {
	// Create the stdout exporter to print log records as JSON to standard output
	exp, err := stdoutlog.New()
	if err != nil {
		slog.Error("failed to create OTel stdout log exporter", "error", err)
	}

	// Create log processor
	processor := sdklog.NewSimpleProcessor(exp)

	// Initialize LoggerProvider with the stdout processor
	provider := sdklog.NewLoggerProvider(sdklog.WithProcessor(processor))
	
	// Set the global LoggerProvider
	global.SetLoggerProvider(provider)

	// Create and set the official otelslog Handler as default slog handler
	otelHandler := otelslog.NewHandler("meris-api")
	logger := slog.New(otelHandler)
	slog.SetDefault(logger)

	slog.Info("Structured logger initialized with OpenTelemetry otelslog bridge.")
}
