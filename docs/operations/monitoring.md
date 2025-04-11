# Monitoring and Observability

This document outlines the monitoring and observability strategy for the BioPlatform, ensuring high availability and performance for users worldwide.

## Monitoring Architecture

BioPlatform implements a comprehensive monitoring architecture that provides end-to-end visibility into application performance, infrastructure health, and user experience across all global regions.

![Monitoring Architecture](../assets/monitoring-architecture.png)

## Metrics Collection

### Application Metrics

| Metric Type | Description | Tool | Alert Threshold |
|-------------|-------------|------|----------------|
| Request Rate | Incoming requests per second | Prometheus | > 500/s (warning), > 1000/s (critical) |
| Response Time | Time to respond to requests | Prometheus | > 200ms (warning), > 500ms (critical) |
| Error Rate | Percentage of 4xx/5xx responses | Prometheus | > 1% (warning), > 5% (critical) |
| Saturation | Resource usage percentage | Prometheus | > 80% (warning), > 90% (critical) |
| Apdex Score | User satisfaction score | New Relic | < 0.9 (warning), < 0.8 (critical) |

### Infrastructure Metrics

| Metric Type | Description | Tool | Alert Threshold |
|-------------|-------------|------|----------------|
| CPU Utilization | CPU usage percentage | Prometheus | > 80% (warning), > 90% (critical) |
| Memory Usage | Memory consumption | Prometheus | > 80% (warning), > 90% (critical) |
| Disk Usage | Storage space utilization | Prometheus | > 80% (warning), > 90% (critical) |
| Network Traffic | Inbound/outbound traffic | Prometheus | > 80% capacity (warning) |
| Container Health | Container status checks | Prometheus | Any unhealthy container (critical) |

### Database Metrics

| Metric Type | Description | Tool | Alert Threshold |
|-------------|-------------|------|----------------|
| Query Performance | Slow query count | PostgreSQL Exporter | > 10 slow queries/min (warning) |
| Connection Pool | Connection utilization | PostgreSQL Exporter | > 80% pool usage (warning) |
| Replication Lag | Delay between primary/replica | PostgreSQL Exporter | > 10s (warning), > 30s (critical) |
| Index Hit Ratio | Cache effectiveness | PostgreSQL Exporter | < 95% (warning), < 90% (critical) |
| Transaction Rate | Transactions per second | PostgreSQL Exporter | > 500/s (warning) |

### Business Metrics

| Metric Type | Description | Tool | Alert Threshold |
|-------------|-------------|------|----------------|
| Active Users | Currently active users | Custom Metrics | N/A (tracking only) |
| Workflow Completions | Completed analysis workflows | Custom Metrics | < 80% completion rate (warning) |
| Error Frequency | Errors by feature | Custom Metrics | > 1% error rate (warning) |
| Geographic Usage | Usage by region | Custom Metrics | N/A (tracking only) |
| Feature Adoption | Usage of new features | Custom Metrics | N/A (tracking only) |

## Logging Strategy

### Log Levels

- **ERROR**: System errors requiring immediate attention
- **WARN**: Potential issues that don't stop functionality
- **INFO**: Important business events and state changes
- **DEBUG**: Detailed information for troubleshooting (non-production)
- **TRACE**: Very detailed tracing information (development only)

### Log Formats

All logs use structured JSON format with consistent fields:

```json
{
  "timestamp": "2025-04-11T14:32:13.001Z",
  "level": "INFO",
  "service": "api-server",
  "instance": "api-server-5d8f7b9c4-xj2wp",
  "trace_id": "4f8d1b3a9c2e5f7a",
  "span_id": "7a2c5e9b3f1d8",
  "user_id": "f7a2c5e9-b3f1-4d8a-9c2e-5f7a2c5e9b3f",
  "message": "User profile updated successfully",
  "context": {
    "feature": "user-management",
    "latency_ms": 45,
    "region": "us-west"
  }
}
```

### Log Collection and Storage

- **Collection**: Fluent Bit on each container
- **Processing**: Fluentd for aggregation and enrichment
- **Storage**: Elasticsearch (7-day hot storage, 90-day warm storage)
- **Archival**: S3 for long-term storage (1-year retention)
- **Visualization**: Kibana dashboards

## Alerting System

### Alert Priorities

1. **P1 (Critical)**: Immediate response required (24/7)
2. **P2 (High)**: Response required within 1 hour
3. **P3 (Medium)**: Response required within 24 hours
4. **P4 (Low)**: Response during business hours

### Alert Channels

- **Primary**: PagerDuty for on-call rotation
- **Secondary**: Slack channels by team
- **Escalation**: SMS and phone calls for P1/P2 alerts
- **Status Page**: Automatic updates to status.bioplatform.org

### Alert Rules

| Alert Name | Description | Priority | Response SLA |
|------------|-------------|----------|--------------|
| Service Down | Critical service unavailable | P1 | 5 minutes |
| High Error Rate | Error rate exceeding threshold | P1 | 5 minutes |
| Database Latency | DB response time too high | P2 | 30 minutes |
| Disk Space Critical | Disk space critically low | P2 | 30 minutes |
| CPU Overload | Sustained high CPU usage | P2 | 30 minutes |
| Memory Leak | Increasing memory consumption | P2 | 30 minutes |
| Slow Response Time | API endpoints responding slowly | P3 | 4 hours |
| Certificate Expiry | SSL cert expiring soon | P3 | 4 hours |
| Job Failure | Background job failure | P3/P4 | 4-24 hours |

## Dashboards

### Operational Dashboards

1. **System Overview**: High-level health of all systems
2. **API Performance**: Detailed API metrics by endpoint
3. **Database Performance**: Query performance and health
4. **Infrastructure**: Kubernetes cluster and VM metrics
5. **CDN & Edge**: Global CDN performance metrics
6. **Error Tracking**: Application errors and exceptions

### Business Dashboards

1. **User Engagement**: Active users and session metrics
2. **Workflow Analytics**: Bioinformatics workflow usage
3. **Geographic Distribution**: Usage by region/country
4. **Feature Adoption**: Feature usage trends
5. **Data Processing**: Volume of data processed

## Tracing

### Distributed Tracing

BioPlatform uses OpenTelemetry for distributed tracing across all services:

- **Instrumentation**: Automatic and manual instrumentation
- **Sampling**: 100% of errors, 10% of normal requests
- **Visualization**: Jaeger UI for trace exploration
- **Integration**: Traces linked to logs and metrics

### Key Trace Points

1. **API Gateway**: Entry point for all requests
2. **Authentication**: User authentication flow
3. **Database Operations**: All database queries
4. **External Services**: Calls to third-party services
5. **Background Jobs**: Asynchronous processing

## Health Checks

### Endpoint Health

- **Public Health**: /health for basic availability check
- **Detailed Health**: /health/detailed for component status (authenticated)
- **Component Health**: Individual health endpoints for each service

### Synthetic Monitoring

- **Global Checks**: Synthetic tests from multiple regions
- **Key Workflows**: End-to-end testing of critical user journeys
- **Frequency**: Every 1 minute for critical paths
- **Alert Integration**: Alerts for failed synthetic tests

## Capacity Planning

### Metrics for Scaling

1. **Request Rate**: Incoming requests per minute
2. **CPU Utilization**: Average CPU usage
3. **Memory Usage**: Average memory consumption
4. **Database Connections**: Connection pool utilization
5. **Queue Depth**: Background job queue length

### Auto-scaling Configuration

| Service | Scale Up Trigger | Scale Down Trigger | Min | Max | Cooldown |
|---------|-----------------|-------------------|-----|-----|----------|
| Frontend | CPU > 70% for 2m | CPU < 30% for 10m | 3 | 20 | 5m |
| API | Request rate > 1000/s | Request rate < 500/s | 5 | 30 | 3m |
| Workers | Queue depth > 1000 | Queue depth < 100 | 2 | 50 | 5m |
| Database | N/A (manual scaling) | N/A | N/A | N/A | N/A |

## Disaster Recovery Monitoring

- **Backup Success**: Monitoring of backup completion
- **Replication Lag**: Database replication status
- **Recovery Testing**: Automated recovery test results
- **Data Integrity**: Checksums and validation tests

## Geographic Monitoring

- **Global Edge Latency**: Response times by region
- **CDN Cache Hit Rate**: Cache performance by region
- **Regional Availability**: Uptime by geographic region
- **Traffic Distribution**: Request volume by region

## User Experience Monitoring

- **Page Load Time**: By page and geographic region
- **Time to Interactive**: User interaction responsiveness
- **Error Rate**: Frontend errors and exceptions
- **Core Web Vitals**: LCP, FID, CLS metrics globally

## On-call Procedures

Detailed procedures are maintained in the [On-call Playbook](./oncall-playbook.md), including:

1. **Escalation Paths**: Who to contact when
2. **Incident Response**: Steps to diagnose common issues
3. **Runbooks**: Detailed technical response procedures
4. **Post-mortem Process**: Incident analysis and follow-up