.PHONY: dev up generate test clean install-deps build-all

# Run both api backend and client frontend concurrently
up: dev

dev:
	@echo "Starting backend and frontend dev servers concurrently..."
	(cd api && go run cmd/server/main.go) & (cd client && npm run dev)

# Execute code generation pipelines
generate:
	@echo "Running backend OpenAPI generation..."
	oapi-codegen -config api/oapi-codegen.yaml contracts/openapi.yaml
	@echo "Running backend SQLC generation..."
	cd api && sqlc generate
	@echo "Running frontend OpenAPI type generation..."
	cd client && npm run generate-api-types || echo "No API types generator configured yet"

# Run tests for both backend and client
test:
	@echo "Running Go backend unit tests..."
	cd api && go test ./... -v
	@echo "Running client linting..."
	cd client && npm run lint || echo "No client lint target configured"

# Install all dependencies for both projects
install-deps:
	@echo "Installing Go backend dependencies..."
	cd api && go mod download
	@echo "Installing Next.js client dependencies..."
	cd client && npm install

# Build production bundles
build-all:
	@echo "Building Go backend..."
	cd api && go build -o bin/server cmd/server/main.go
	@echo "Building Next.js client..."
	cd client && npm run build

