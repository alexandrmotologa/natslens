.PHONY: all build-ui build-go build test run-demo clean

VERSION ?= 0.1.0
BINARY_NAME = natslens

all: build

build-ui:
	cd ui && npm install && npm run build

build-go:
	go build -ldflags="-s -w -X 'main.Version=$(VERSION)'" -o $(BINARY_NAME) .

build: build-ui build-go

test:
	go test -v -race ./...

run-demo:
	go run . demo --port 8080

clean:
	rm -rf $(BINARY_NAME) $(BINARY_NAME).exe ui/dist ui/node_modules
