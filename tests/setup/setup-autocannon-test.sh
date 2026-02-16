#!/bin/bash

echo "🚀 Setting up Autocannon Full Flow Load Test"
echo "============================================="
echo ""

# Check if PostgreSQL is running
echo "1️⃣  Checking PostgreSQL..."
psql -U postgres -c "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ PostgreSQL is running"
else
    echo "   ❌ PostgreSQL is not running"
    exit 1
fi

# Check if Redis is running
echo ""
echo "2️⃣  Checking Redis..."
redis-cli ping > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ Redis is running"
else
    echo "   ❌ Redis is not running - start with: redis-server"
    exit 1
fi

# Check user count
echo ""
echo "3️⃣  Checking users..."
USER_COUNT=$(psql -U postgres -d airport_pooling -t -c "SELECT count(*) FROM users;" 2>/dev/null | xargs)
echo "   Current users: $USER_COUNT"

if [ "$USER_COUNT" -lt 1000 ]; then
    echo "   ⚠️  Less than 1000 users. Seeding 10,000 users..."
    npm run seed:10k
else
    echo "   ✓ Sufficient users"
fi

# Check cab count
echo ""
echo "4️⃣  Checking cabs..."
CAB_COUNT=$(psql -U postgres -d airport_pooling -t -c "SELECT count(*) FROM cabs;" 2>/dev/null | xargs)
AVAILABLE_CABS=$(psql -U postgres -d airport_pooling -t -c "SELECT count(*) FROM cabs WHERE is_available = true;" 2>/dev/null | xargs)
echo "   Total cabs: $CAB_COUNT"
echo "   Available cabs: $AVAILABLE_CABS"

if [ "$CAB_COUNT" -lt 1000 ]; then
    echo "   ⚠️  Less than 1000 cabs. Seeding 1000 cabs..."
    node seed-cabs.js 1000
elif [ "$AVAILABLE_CABS" -lt 500 ]; then
    echo "   ⚠️  Less than 500 available cabs. Freeing up all cabs..."
    psql -U postgres -d airport_pooling -c "UPDATE cabs SET is_available = true;" > /dev/null 2>&1
    echo "   ✓ All cabs freed"
else
    echo "   ✓ Sufficient cabs"
fi

# Clear old data
echo ""
echo "5️⃣  Cleaning up old data..."
DELETED_REQUESTS=$(psql -U postgres -d airport_pooling -t -c "DELETE FROM ride_requests WHERE created_at < NOW() - INTERVAL '1 hour' RETURNING id;" 2>/dev/null | wc -l)
DELETED_RIDES=$(psql -U postgres -d airport_pooling -t -c "DELETE FROM rides WHERE created_at < NOW() - INTERVAL '1 hour' RETURNING id;" 2>/dev/null | wc -l)
echo "   Deleted $DELETED_REQUESTS old ride requests"
echo "   Deleted $DELETED_RIDES old rides"

# Clear Redis
echo ""
echo "6️⃣  Clearing Redis cache..."
redis-cli FLUSHDB > /dev/null 2>&1
echo "   ✓ Redis cache cleared"

# Clear connection pools
echo ""
echo "7️⃣  Clearing connection pools..."
bash clear-pools.sh > /dev/null 2>&1
echo "   ✓ Connection pools cleared"

# Optimize database
echo ""
echo "8️⃣  Optimizing database..."
psql -U postgres -d airport_pooling -c "VACUUM ANALYZE ride_requests, rides, cabs;" > /dev/null 2>&1
echo "   ✓ Database optimized"

# Final status
echo ""
echo "============================================="
echo "✅ Setup Complete!"
echo "============================================="
echo ""

# Get final counts
FINAL_USERS=$(psql -U postgres -d airport_pooling -t -c "SELECT count(*) FROM users;" 2>/dev/null | xargs)
FINAL_CABS=$(psql -U postgres -d airport_pooling -t -c "SELECT count(*) FROM cabs WHERE is_available = true;" 2>/dev/null | xargs)
POOL_SIZE=$(grep DB_POOL_SIZE .env | cut -d'=' -f2)

echo "📊 System Status:"
echo "   Users:           $FINAL_USERS"
echo "   Available Cabs:  $FINAL_CABS"
echo "   Pool Size:       $POOL_SIZE"
echo "   Redis:           Ready"
echo "   PostgreSQL:      Ready"
echo ""
echo "🚀 Ready for high-performance load test!"
echo ""
echo "Commands:"
echo "   npm run load-test:autocannon   # Run autocannon full flow test"
echo "   npm run monitor                # Monitor connections (separate terminal)"
echo ""
echo "Expected Performance:"
echo "   Request Creation:  3,000+ RPS"
echo "   Rides Confirmed:   500-1,000 total"
echo "   Success Rate:      > 95%"
echo ""

