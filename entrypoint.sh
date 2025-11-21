#!/bin/sh
set -e

echo "🚀 Starting SmartStore AI Platform..."

# Function to wait for database
wait_for_database() {
    echo "⏳ Waiting for database to be ready..."
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        # Try to connect to MongoDB using mongosh (if available) or Prisma
        if command -v mongosh > /dev/null 2>&1; then
            if mongosh "$DATABASE_URL" --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
                echo "✅ Database is ready!"
                return 0
            fi
        else
            # Fallback: try Prisma connection (will fail gracefully if DB not ready)
            if npx prisma db execute --stdin <<< "db.adminCommand('ping')" > /dev/null 2>&1; then
                echo "✅ Database is ready!"
                return 0
            fi
        fi
        
        attempt=$((attempt + 1))
        echo "Database is unavailable - attempt $attempt/$max_attempts (sleeping 2s)..."
        sleep 2
    done
    
    echo "⚠️  Database connection check failed, but continuing..."
    return 0
}

# Wait for database to be ready
wait_for_database || {
    echo "⚠️  Database not ready, but continuing..."
}

# Run database migrations
echo "📦 Running database migrations..."
if npx prisma migrate deploy > /dev/null 2>&1; then
    echo "✅ Migrations applied successfully!"
elif npx prisma db push > /dev/null 2>&1; then
    echo "✅ Database schema pushed successfully!"
else
    echo "⚠️  Migration failed, but continuing..."
fi

# Start the application
echo "🚀 Starting Next.js application..."
exec node server.js

