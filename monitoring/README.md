# Monitoring & Observability

This directory contains monitoring configurations, dashboards, and observability tools for the SmartStore AI platform.

## 📊 Monitoring Stack

### Application Monitoring
- **Health Checks**: `/api/health` endpoint
- **Readiness Probe**: `/api/readyz`
- **Liveness Probe**: `/api/ready`

### Logging
- Application logs via Vercel/CloudWatch
- Docker container logs
- API request logs

### Metrics (To Be Implemented)
- Application performance metrics
- Database query performance
- API response times
- Error rates

## 🔍 Health Check Endpoints

### Application Health
```bash
curl http://localhost:3000/api/health
```

### Database Health
```bash
# MongoDB
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Redis
docker-compose exec redis redis-cli ping
```

## 📈 Monitoring Tools

### Vercel Dashboard
- Deployment metrics
- Function execution logs
- Performance analytics
- Error tracking

### Docker Monitoring
```bash
# View container stats
docker stats

# View logs
docker-compose logs -f

# Check service health
docker-compose ps
```

## 🔔 Alerting (To Be Configured)

### Planned Alert Types
- High error rates
- Slow response times
- Database connection issues
- Service downtime
- Resource exhaustion

## 📝 Logging Best Practices

1. **Structured Logging**: Use JSON format for logs
2. **Log Levels**: INFO, WARN, ERROR, DEBUG
3. **Sensitive Data**: Never log passwords, tokens, or PII
4. **Context**: Include request IDs, user IDs, timestamps

## 🛠️ Setup Instructions

### Local Development
```bash
# View logs
npm run docker:logs

# Check health
curl http://localhost:3000/api/health
```

### Production
- Monitor via Vercel Dashboard
- Set up external monitoring (e.g., Datadog, New Relic)
- Configure alerting rules

## 📚 Additional Resources

- [Vercel Monitoring](https://vercel.com/docs/observability)
- [Docker Monitoring](https://docs.docker.com/config/containers/logging/)
- [Application Performance Monitoring](https://vercel.com/docs/analytics)

---

**Last Updated**: $(date)

