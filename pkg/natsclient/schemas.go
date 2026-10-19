package natsclient

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/alexandrmotologa/natslens/pkg/models"
)

// SchemaRegistry manages schema definitions and payload validations.
type SchemaRegistry struct {
	mu      sync.RWMutex
	schemas map[string]models.SchemaDefinition
}

// NewSchemaRegistry creates and initializes a schema registry with sample schemas.
func NewSchemaRegistry() *SchemaRegistry {
	r := &SchemaRegistry{
		schemas: make(map[string]models.SchemaDefinition),
	}

	// Seed standard schemas
	r.SaveSchema(models.SchemaDefinition{
		ID:             "schema-orders",
		Name:           "OrderEventSchema",
		SubjectPattern: "orders.>",
		SchemaType:     "json",
		Content: `{
  "type": "object",
  "required": ["orderId", "customerId", "amount", "status"],
  "properties": {
    "orderId": { "type": "string" },
    "customerId": { "type": "string" },
    "amount": { "type": "number" },
    "status": { "type": "string" },
    "items": { "type": "array" }
  }
}`,
		Description: "Schema validation for all JetStream order lifecycle events.",
		CreatedAt:   time.Now().Add(-24 * time.Hour),
		UpdatedAt:   time.Now(),
	})

	r.SaveSchema(models.SchemaDefinition{
		ID:             "schema-telemetry",
		Name:           "SensorTelemetrySchema",
		SubjectPattern: "telemetry.>",
		SchemaType:     "json",
		Content: `{
  "type": "object",
  "required": ["sensorId", "metric", "value", "unit"],
  "properties": {
    "sensorId": { "type": "string" },
    "metric": { "type": "string" },
    "value": { "type": "number" },
    "unit": { "type": "string" }
  }
}`,
		Description: "Schema validation for IoT sensor metrics and telemetry.",
		CreatedAt:   time.Now().Add(-12 * time.Hour),
		UpdatedAt:   time.Now(),
	})

	return r
}

// ListSchemas returns all registered schemas.
func (r *SchemaRegistry) ListSchemas() []models.SchemaDefinition {
	r.mu.RLock()
	defer r.mu.RUnlock()

	list := make([]models.SchemaDefinition, 0, len(r.schemas))
	for _, s := range r.schemas {
		list = append(list, s)
	}
	return list
}

// GetSchema returns a schema by ID.
func (r *SchemaRegistry) GetSchema(id string) (models.SchemaDefinition, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	s, ok := r.schemas[id]
	return s, ok
}

// SaveSchema creates or updates a schema.
func (r *SchemaRegistry) SaveSchema(s models.SchemaDefinition) models.SchemaDefinition {
	r.mu.Lock()
	defer r.mu.Unlock()

	if s.ID == "" {
		s.ID = fmt.Sprintf("schema-%d", time.Now().UnixNano())
	}
	if s.CreatedAt.IsZero() {
		s.CreatedAt = time.Now()
	}
	s.UpdatedAt = time.Now()
	r.schemas[s.ID] = s
	return s
}

// DeleteSchema removes a schema by ID.
func (r *SchemaRegistry) DeleteSchema(id string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.schemas[id]; ok {
		delete(r.schemas, id)
		return true
	}
	return false
}

// FindMatchingSchema finds the first schema matching the subject token pattern.
func (r *SchemaRegistry) FindMatchingSchema(subject string) *models.SchemaDefinition {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, s := range r.schemas {
		if MatchNatsSubject(s.SubjectPattern, subject) {
			copyS := s
			return &copyS
		}
	}
	return nil
}

// ValidatePayload validates a payload against matching or specified schema.
func (r *SchemaRegistry) ValidatePayload(req models.ValidatePayloadRequest) models.ValidatePayloadResponse {
	var targetSchema *models.SchemaDefinition

	if req.SchemaID != "" {
		if s, ok := r.GetSchema(req.SchemaID); ok {
			targetSchema = &s
		}
	} else if req.Subject != "" {
		targetSchema = r.FindMatchingSchema(req.Subject)
	}

	if targetSchema == nil {
		return models.ValidatePayloadResponse{
			Valid:  true,
			Errors: []string{"No matching schema found for subject; raw payload is allowed."},
		}
	}

	res := models.ValidatePayloadResponse{
		MatchedSchema:  targetSchema.Name,
		MatchedPattern: targetSchema.SubjectPattern,
	}

	// Basic JSON syntax check
	var rawData interface{}
	if err := json.Unmarshal([]byte(req.Payload), &rawData); err != nil {
		res.Valid = false
		res.Errors = append(res.Errors, fmt.Sprintf("Payload is not valid JSON: %v", err))
		return res
	}

	// Schema structure parse
	var schemaMap map[string]interface{}
	if err := json.Unmarshal([]byte(targetSchema.Content), &schemaMap); err != nil {
		res.Valid = false
		res.Errors = append(res.Errors, fmt.Sprintf("Schema definition syntax error: %v", err))
		return res
	}

	// Validate required fields
	payloadObj, isObj := rawData.(map[string]interface{})
	if !isObj {
		res.Valid = false
		res.Errors = append(res.Errors, "Expected root payload to be a JSON object")
		return res
	}

	if reqFields, ok := schemaMap["required"].([]interface{}); ok {
		for _, rf := range reqFields {
			fieldName := fmt.Sprintf("%v", rf)
			if _, exists := payloadObj[fieldName]; !exists {
				res.Errors = append(res.Errors, fmt.Sprintf("Missing required field: %q", fieldName))
			}
		}
	}

	// Validate types if specified
	if props, ok := schemaMap["properties"].(map[string]interface{}); ok {
		for propKey, propDefRaw := range props {
			val, exists := payloadObj[propKey]
			if !exists {
				continue
			}
			propDef, okDef := propDefRaw.(map[string]interface{})
			if !okDef {
				continue
			}
			expectedType, hasType := propDef["type"].(string)
			if !hasType {
				continue
			}

			if !matchesJSONType(val, expectedType) {
				res.Errors = append(res.Errors, fmt.Sprintf("Field %q expects type %s, got %T", propKey, expectedType, val))
			}
		}
	}

	res.Valid = len(res.Errors) == 0
	return res
}

func matchesJSONType(val interface{}, expected string) bool {
	switch expected {
	case "string":
		_, ok := val.(string)
		return ok
	case "number":
		_, ok := val.(float64)
		return ok
	case "boolean":
		_, ok := val.(bool)
		return ok
	case "array":
		_, ok := val.([]interface{})
		return ok
	case "object":
		_, ok := val.(map[string]interface{})
		return ok
	default:
		return true
	}
}

// MatchNatsSubject checks if subject matches a NATS pattern (*, >).
func MatchNatsSubject(pattern, subject string) bool {
	if pattern == subject || pattern == ">" {
		return true
	}

	patTokens := strings.Split(pattern, ".")
	subTokens := strings.Split(subject, ".")

	for i, p := range patTokens {
		if p == ">" {
			return true
		}
		if i >= len(subTokens) {
			return false
		}
		if p != "*" && p != subTokens[i] {
			return false
		}
	}

	return len(patTokens) == len(subTokens)
}
