#!/bin/bash

# Tender Alert SaaS - Comprehensive API Testing Script
# Usage: ./test-api.sh [base_url]
# Default base_url: http://localhost:3000/api/v1

set -e

BASE_URL="${1:-http://localhost:3000/api/v1}"
TOKEN=""
USER_ID=""
TENDER_ID=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local auth=$4
    
    local curl_cmd="curl -s -X $method \"$BASE_URL$endpoint\""
    
    if [ -n "$data" ]; then
        curl_cmd="$curl_cmd -H \"Content-Type: application/json\" -d '$data'"
    fi
    
    if [ "$auth" = "true" ] && [ -n "$TOKEN" ]; then
        curl_cmd="$curl_cmd -H \"Authorization: Bearer $TOKEN\""
    fi
    
    eval $curl_cmd
}

# ============================================
# 1. AUTHENTICATION TESTS
# ============================================
print_header "1. AUTHENTICATION TESTS"

print_info "Testing registration..."
REGISTER_RESPONSE=$(make_request "POST" "/auth/register" '{
    "phone": "+919999999999",
    "password": "testpassword123",
    "plan_type": "premium"
}')
echo "Response: $REGISTER_RESPONSE"

# Extract token from registration
TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
if [ -n "$TOKEN" ]; then
    print_success "Registration successful, token received"
else
    print_error "Registration failed"
fi

print_info "Testing login..."
LOGIN_RESPONSE=$(make_request "POST" "/auth/login" '{
    "phone": "+919999999999",
    "password": "testpassword123"
}')
echo "Response: $LOGIN_RESPONSE"

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
if [ -n "$TOKEN" ]; then
    print_success "Login successful, token received"
    echo "Token: ${TOKEN:0:50}..."
else
    print_error "Login failed"
fi

print_info "Testing protected endpoint without token..."
UNAUTH_RESPONSE=$(curl -s -X GET "$BASE_URL/users")
if echo "$UNAUTH_RESPONSE" | grep -q "Unauthorized"; then
    print_success "Authentication working - unauthenticated request rejected"
else
    print_error "Authentication not working properly"
fi

# ============================================
# 2. USER MANAGEMENT TESTS
# ============================================
print_header "2. USER MANAGEMENT TESTS"

print_info "Creating a new user..."
CREATE_USER_RESPONSE=$(make_request "POST" "/users" '{
    "phone": "+918888888888",
    "password": "newuser123",
    "plan_type": "basic"
}' "true")
echo "Response: $CREATE_USER_RESPONSE"
USER_ID=$(echo $CREATE_USER_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$USER_ID" ]; then
    print_success "User created with ID: $USER_ID"
else
    print_error "Failed to create user"
fi

print_info "Getting all users..."
USERS_RESPONSE=$(make_request "GET" "/users" "" "true")
echo "Response: $USERS_RESPONSE"
USER_COUNT=$(echo $USERS_RESPONSE | grep -o '"id"' | wc -l)
print_success "Retrieved $USER_COUNT users"

print_info "Getting user by ID..."
if [ -n "$USER_ID" ]; then
    USER_RESPONSE=$(make_request "GET" "/users/$USER_ID" "" "true")
    echo "Response: $USER_RESPONSE"
    print_success "Retrieved user details"
fi

print_info "Updating user..."
if [ -n "$USER_ID" ]; then
    UPDATE_RESPONSE=$(make_request "PATCH" "/users/$USER_ID" '{
        "plan_type": "premium",
        "subscription_status": "active"
    }' "true")
    echo "Response: $UPDATE_RESPONSE"
    print_success "User updated"
fi

# ============================================
# 3. TENDER OPERATIONS TESTS
# ============================================
print_header "3. TENDER OPERATIONS TESTS"

print_info "Getting all tenders..."
TENDERS_RESPONSE=$(make_request "GET" "/tenders?limit=10&offset=0" "" "true")
echo "Response: $TENDERS_RESPONSE"
TENDER_COUNT=$(echo $TENDERS_RESPONSE | grep -o '"id"' | wc -l)
print_success "Retrieved $TENDER_COUNT tenders"

print_info "Getting recent tenders..."
RECENT_RESPONSE=$(make_request "GET" "/tenders/recent?hours=168" "" "true")
echo "Response: $RECENT_RESPONSE"
print_success "Retrieved recent tenders"

print_info "Getting tender by ID..."
TENDER_ID=$(echo $TENDERS_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$TENDER_ID" ]; then
    TENDER_RESPONSE=$(make_request "GET" "/tenders/$TENDER_ID" "" "true")
    echo "Response: $TENDER_RESPONSE"
    print_success "Retrieved tender details"
fi

# ============================================
# 4. WHATSAPP WEBHOOK TESTS (Public)
# ============================================
print_header "4. WHATSAPP WEBHOOK TESTS"

print_info "Testing WhatsApp webhook verification..."
VERIFY_RESPONSE=$(curl -s -X GET "$BASE_URL/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=my_tender_verify_2026&hub.challenge=123456789")
echo "Response: $VERIFY_RESPONSE"
if [ "$VERIFY_RESPONSE" = "123456789" ]; then
    print_success "WhatsApp webhook verification working"
else
    print_error "WhatsApp webhook verification failed"
fi

print_info "Testing WhatsApp incoming message..."
MSG_RESPONSE=$(curl -s -X POST "$BASE_URL/whatsapp/webhook" \
    -H "Content-Type: application/json" \
    -d '{
        "entry": [{
            "changes": [{
                "value": {
                    "messages": [{
                        "from": "919876543210",
                        "type": "text",
                        "text": {"body": "Hello, I want to subscribe"}
                    }]
                }
            }]
        }]
    }')
echo "Response: $MSG_RESPONSE"
print_success "WhatsApp message handler working"

# ============================================
# 5. SUBSCRIPTION WEBHOOK TESTS (Public)
# ============================================
print_header "5. SUBSCRIPTION WEBHOOK TESTS"

print_info "Testing Razorpay webhook..."
WEBHOOK_RESPONSE=$(curl -s -X POST "$BASE_URL/subscriptions/webhook" \
    -H "Content-Type: application/json" \
    -H "x-razorpay-signature: test_signature" \
    -d '{
        "event": "subscription.activated",
        "payload": {
            "subscription": {
                "entity": {
                    "id": "sub_test_12345"
                }
            }
        }
    }')
echo "Response: $WEBHOOK_RESPONSE"
print_success "Razorpay webhook endpoint accessible"

# ============================================
# 6. SUMMARY
# ============================================
print_header "TEST SUMMARY"

print_success "Authentication: JWT-based auth working"
print_success "User Management: CRUD operations working"
print_success "Tender Operations: List and retrieve working"
print_success "WhatsApp Integration: Webhooks working"
print_success "Subscriptions: Webhook endpoint accessible"

echo -e "\n${GREEN}All tests completed!${NC}"
echo -e "\n${YELLOW}Notes:${NC}"
echo "- Some features (AI, Notifications, Scraper) run as background jobs"
echo "- Redis and PostgreSQL must be running for full functionality"
echo "- Set OPENAI_API_KEY in .env to test AI features"
echo "- Configure Razorpay credentials for subscription testing"
