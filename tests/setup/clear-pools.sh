#!/bin/bash

echo "🧹 Clearing Connection Pools and Preparing for Load Test"
echo "=========================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Kill idle PostgreSQL connections
echo "1️⃣  Terminating idle PostgreSQL connections..."
KILLED=$(psql -U postgres -d airport_pooling -t -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'airport_pooling' 
  AND pid <> pg_backend_pid()
  AND state = 'idle'
  AND state_change < NOW() - INTERVAL '30 seconds';
" 2>/dev/null | grep -c 't')

if [ $? -eq 0 ]; then
    echo -e "   ${GREEN}✓${NC} Terminated $KILLED idle connections"
else
    echo -e "   ${RED}✗${NC} Failed to terminate connections"
fi

# 2. Check current connection count
echo ""
echo "2️⃣  Checking PostgreSQL connection status..."
ACTIVE=$(psql -U postgres -d airport_pooling -t -c "
SELECT count(*) 
FROM pg_stat_activity 
WHERE datname = 'airport_pooling';
" 2>/dev/null | xargs)

MAX_CONN=$(psql -U postgres -t -c "SHOW max_connections;" 2>/dev/null | xargs)

echo "   Active connections: $ACTIVE / $MAX_CONN"

if [ "$ACTIVE" -gt 50 ]; then
    echo -e "   ${YELLOW}⚠${NC}  Warning: $ACTIVE connections still active"
    echo "   Consider restarting PostgreSQL: sudo systemctl restart postgresql"
else
    echo -e "   ${GREEN}✓${NC} Connection count is healthy"
fi

# 3. Clear Redis cache
echo ""
echo "3️⃣  Clearing Redis cache..."
redis-cli FLUSHDB > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "   ${GREEN}✓${NC} Redis cache cleared"
else
    echo -e "   ${RED}✗${NC} Redis not running - start with: redis-server"
    exit 1
fi

# 4. Clear old ride requests (keep DB clean)
echo ""
echo "4️⃣  Clearing old ride requests..."
DELETED=$(psql -U postgres -d airport_pooling -t -c "
DELETE FROM ride_requests 
WHERE created_at < NOW() - INTERVAL '1 hour'
RETURNING id;
" 2>/dev/null | wc -l)

echo -e "   ${GREEN}✓${NC} Deleted $DELETED old ride requests"

# 5. Vacuum database (optional but recommended)
echo ""
echo "5️⃣  Optimizing database..."
psql -U postgres -d airport_pooling -c "VACUUM ANALYZE ride_requests;" > /dev/null 2>&1
echo -e "   ${GREEN}✓${NC} Database optimized"

# 6. Check user count
echo ""
echo "6️⃣  Verifying test data..."
USER_COUNT=$(psql -U postgres -d airport_pooling -t -c "SELECT count(*) FROM users;" 2>/dev/null | xargs)
echo "   Users in database: $USER_COUNT"

if [ "$USER_COUNT" -lt 1000 ]; then
    echo -e "   ${YELLOW}⚠${NC}  Less than 1000 users. Run: npm run seed:10k"
fi

# 7. Display current configuration
echo ""
echo "7️⃣  Current configuration:"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   PostgreSQL:"
echo "     • max_connections:     $MAX_CONN"
echo "     • active connections:  $ACTIVE"
DB_POOL=$(grep DB_POOL_SIZE .env | cut -d'=' -f2)
echo "     • app pool size:       $DB_POOL"
echo ""
echo "   Application:"
RATE_LIMIT=$(grep RATE_LIMIT_MAX_REQUESTS .env | cut -d'=' -f2)
echo "     • rate limit:          $RATE_LIMIT req/min"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 8. Restart recommendation
echo ""
echo "8️⃣  Recommendations:"
if [ "$ACTIVE" -gt 30 ]; then
    echo -e "   ${YELLOW}⚠${NC}  High connection count detected"
    echo "   Recommended: Restart Node.js server to clear app pool"
    echo "   Command: pkill -f 'node.*index' && npm run dev"
fi

# 9. Final status
echo ""
echo "=========================================================="
echo -e "${GREEN}✅ System prepared for load testing!${NC}"
echo ""
echo "Next steps:"
echo "  1. Ensure Node.js server is running: npm run dev"
echo "  2. Run load test: npm run load-test"
echo ""
echo "Monitor during test:"
echo "  • PostgreSQL: watch -n 1 'psql -U postgres -d airport_pooling -c \"SELECT count(*) FROM pg_stat_activity WHERE datname = '\"'\"'airport_pooling'\"'\"';\"'"
echo "  • Server logs: tail -f logs/app.log (if logging enabled)"
echo ""

