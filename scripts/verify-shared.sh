#!/bin/bash
# scripts/verify-shared.sh — 共享卡牌库自动化冒烟测试
set -e

PORT=${PORT:-4174}
BASE="http://127.0.0.1:$PORT"
PASS=0
FAIL=0

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}✗ $1${NC}"; FAIL=$((FAIL+1)); }

echo "=== 共享卡牌库冒烟测试 ==="
echo "Base URL: $BASE"
echo ""

# 1. 健康检查
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health")
[ "$STATUS" = "200" ] && pass "GET /api/health → 200" || fail "GET /api/health → $STATUS (expected 200)"

# 2. 空列表
BODY=$(curl -s "$BASE/api/cards")
echo "$BODY" | grep -q '"cards"' && pass "GET /api/cards returns cards array" || fail "GET /api/cards missing cards array"

# 3. 发布（有效 payload）
THUMB="data:image/jpeg;base64,/9j/4AAQSkZJRg=="
PUBLISH_BODY="{\"author\":\"TestUser\",\"card\":{\"id\":\"cb_test\",\"name\":\"TEST CARD\",\"team\":\"TST\",\"style\":\"prism\",\"effect\":\"none\",\"rarity\":\"gold\",\"slabType\":\"raw\",\"badges\":[],\"thumbnail\":\"$THUMB\",\"fullState\":{\"test\":true},\"createdAt\":$(date +%s000)}}"
PUBLISH_RES=$(curl -s -X POST -H "Content-Type: application/json" -d "$PUBLISH_BODY" "$BASE/api/cards")
CARD_ID=$(echo "$PUBLISH_RES" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
TOKEN=$(echo "$PUBLISH_RES" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
[ -n "$CARD_ID" ] && pass "POST /api/cards → got id: $CARD_ID" || fail "POST /api/cards → no id returned"
[ -n "$TOKEN" ] && pass "POST /api/cards → got token" || fail "POST /api/cards → no token returned"

# 4. 列表包含新卡
LIST=$(curl -s "$BASE/api/cards")
echo "$LIST" | grep -q "$CARD_ID" && pass "GET /api/cards includes new card" || fail "GET /api/cards missing new card"

# 5. 详情
DETAIL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cards/$CARD_ID")
[ "$DETAIL_STATUS" = "200" ] && pass "GET /api/cards/:id → 200" || fail "GET /api/cards/:id → $DETAIL_STATUS"

# 6. 缩略图
THUMB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cards/$CARD_ID/thumbnail")
[ "$THUMB_STATUS" = "200" ] && pass "GET /api/cards/:id/thumbnail → 200" || fail "GET /api/cards/:id/thumbnail → $THUMB_STATUS"

# 7. 无 token 删除 → 403
DEL_NO_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/cards/$CARD_ID")
[ "$DEL_NO_TOKEN" = "403" ] && pass "DELETE without token → 403" || fail "DELETE without token → $DEL_NO_TOKEN (expected 403)"

# 8. 错误 token 删除 → 403
DEL_BAD_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/cards/$CARD_ID?token=wrong")
[ "$DEL_BAD_TOKEN" = "403" ] && pass "DELETE with wrong token → 403" || fail "DELETE with wrong token → $DEL_BAD_TOKEN (expected 403)"

# 9. 正确 token 删除 → 200
DEL_OK=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/cards/$CARD_ID?token=$TOKEN")
[ "$DEL_OK" = "200" ] && pass "DELETE with correct token → 200" || fail "DELETE with correct token → $DEL_OK (expected 200)"

# 10. 删除后详情 → 404
DEL_AFTER=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/cards/$CARD_ID")
[ "$DEL_AFTER" = "404" ] && pass "GET deleted card → 404" || fail "GET deleted card → $DEL_AFTER (expected 404)"

# 11. 校验：缺失 fullState → 400
BAD_BODY="{\"author\":\"X\",\"card\":{\"thumbnail\":\"$THUMB\"}}"
BAD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$BAD_BODY" "$BASE/api/cards")
[ "$BAD_STATUS" = "400" ] && pass "POST missing fullState → 400" || fail "POST missing fullState → $BAD_STATUS (expected 400)"

# 12. 校验：无效 thumbnail → 400
BAD_THUMB="{\"author\":\"X\",\"card\":{\"thumbnail\":\"not-a-data-url\",\"fullState\":{}}}"
BAD_THUMB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$BAD_THUMB" "$BASE/api/cards")
[ "$BAD_THUMB_STATUS" = "400" ] && pass "POST invalid thumbnail → 400" || fail "POST invalid thumbnail → $BAD_THUMB_STATUS (expected 400)"

# 13. 静态资源
INDEX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/")
[ "$INDEX_STATUS" = "200" ] && pass "GET / (index.html) → 200" || fail "GET / → $INDEX_STATUS (expected 200)"

JS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/app.js")
[ "$JS_STATUS" = "200" ] && pass "GET /app.js → 200" || fail "GET /app.js → $JS_STATUS (expected 200)"

CSS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/styles.css")
[ "$CSS_STATUS" = "200" ] && pass "GET /styles.css → 200" || fail "GET /styles.css → $CSS_STATUS (expected 200)"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
