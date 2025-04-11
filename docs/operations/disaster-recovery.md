# Disaster Recovery Plan

This document outlines the comprehensive disaster recovery (DR) strategy for BioPlatform to ensure business continuity in the event of system failures, data corruption, or catastrophic events.

## Recovery Objectives

### Recovery Time Objective (RTO)

The maximum acceptable length of time that the application can be offline:

| Service Level | RTO |
|---------------|-----|
| Critical Services (Auth, API Core) | < 10 minutes |
| Essential Services (Data Processing) | < 1 hour |
| Non-Essential Services (Analytics) | < 4 hours |

### Recovery Point Objective (RPO)

The maximum acceptable amount of data loss measured in time:

| Data Type | RPO |
|-----------|-----|
| User Data | < 5 minutes |
| Analysis Results | < 15 minutes |
| System Logs | < 1 hour |

## Disaster Recovery Architecture

BioPlatform implements a multi-region disaster recovery architecture to ensure high availability and data durability:

![DR Architecture Diagram](../assets/dr-architecture.png)

### Primary Components

1. **Multi-Region Deployment**
   - Primary Region: AWS us-east-1 (N. Virginia)
   - DR Region: AWS eu-west-1 (Ireland)
   - Edge Locations: Global CDN with 200+ points of presence

2. **Database Replication**
   - Neon PostgreSQL with regional replicas
   - Continuous synchronization with < 100ms lag
   - Automated failover capability

3. **Data Backup System**
   - Automated snapshots (every 6 hours)
   - Transaction log backups (continuous)
   - Cross-region backup replication

4. **State Management**
   - Stateless application design
   - Distributed session storage
   - Externalized configuration

## Backup Strategy

### Database Backups

| Backup Type | Frequency | Retention | Storage Location |
|-------------|-----------|-----------|------------------|
| Full Snapshot | Daily | 30 days | S3 (multi-region) |
| Incremental Snapshot | 6 hours | 7 days | S3 (multi-region) |
| Transaction Logs | Continuous | 7 days | S3 (multi-region) |

### Configuration Backups

| Backup Type | Frequency | Retention | Storage Location |
|-------------|-----------|-----------|------------------|
| Infrastructure as Code | On change | Indefinite | GitHub + S3 Archive |
| Environment Configs | On change | 90 days | AWS Parameter Store + S3 Archive |
| Secrets | On change | 90 days | AWS Secrets Manager + Vault Backup |

### Application Data Backups

| Backup Type | Frequency | Retention | Storage Location |
|-------------|-----------|-----------|------------------|
| User Files | Daily | 30 days | S3 (multi-region) |
| Generated Reports | Weekly | 90 days | S3 (multi-region) |
| ML Models | On new version | Indefinite | S3 (multi-region) |

## Disaster Scenarios and Recovery Procedures

### Scenario 1: Database Failure

**Detection:**
- Monitoring alert: Database connectivity failure
- Health check failure: API database connection timeout
- Error rate spike: Database-related errors

**Recovery Steps:**

1. **Automatic Failover (0-5 minutes)**
   - Neon PostgreSQL automatic failover to replica
   - Application connection pool refreshes

2. **If Automatic Failover Fails (5-15 minutes)**
   - Operations team receives PagerDuty alert
   - Manual promotion of read replica to primary
   - Update connection strings in application config

3. **Verification (15-20 minutes)**
   - Confirm database is accepting connections
   - Verify data integrity with automated checks
   - Monitor application performance

**Recovery Time:** < 10 minutes with automatic failover, < 20 minutes with manual intervention

### Scenario 2: Region-wide Cloud Provider Outage

**Detection:**
- AWS/Cloud provider status page alert
- Multiple service health checks failing in the same region
- Geographic monitoring showing regional pattern

**Recovery Steps:**

1. **Activate DR Mode (0-5 minutes)**
   - Automated detection of region-wide failure
   - Traffic routing configuration change to DR region
   - DNS failover for API endpoints

2. **Scale DR Resources (5-15 minutes)**
   - Auto-scaling triggered in DR region
   - Provision additional capacity if needed
   - Start background data processing services

3. **Verify DR Functionality (15-30 minutes)**
   - Run automated integration tests against DR environment
   - Monitor error rates and performance metrics
   - Verify data consistency across services

4. **Communication (30-45 minutes)**
   - Update status page with incident information
   - Send notification to affected customers
   - Establish incident command with regular updates

**Recovery Time:** < 30 minutes for critical services, < 1 hour for all services

### Scenario 3: Data Corruption

**Detection:**
- Data integrity checks failing
- Unusual patterns in data validation reports
- Customer reports of incorrect data

**Recovery Steps:**

1. **Containment (0-15 minutes)**
   - Identify affected data scope and timeframe
   - Take snapshot of current database state
   - Enable read-only mode for affected data

2. **Root Cause Analysis (15-45 minutes)**
   - Determine source of corruption
   - Review access logs and change history
   - Isolate corrupted records

3. **Recovery Options Selection (45-60 minutes)**
   - Selective restore of corrupted data
   - Point-in-time recovery to pre-corruption state
   - Data reconstruction from transaction logs

4. **Execute Recovery (1-3 hours)**
   - Restore data from backup
   - Apply transaction logs to reach desired recovery point
   - Run data validation and integrity checks

5. **Verification (3-4 hours)**
   - Validate restored data integrity
   - Run application with restored data in isolation
   - Perform controlled tests of critical functions

**Recovery Time:** 2-4 hours depending on corruption scope

### Scenario 4: Catastrophic Data Center Event

**Detection:**
- Complete loss of connectivity to primary data center
- Multiple critical services down simultaneously
- Cloud provider emergency notification

**Recovery Steps:**

1. **Emergency Response Activation (0-5 minutes)**
   - Incident response team notification and assembly
   - DR plan activation authorization
   - Communication channels established

2. **Multi-region Failover (5-30 minutes)**
   - Activate all DR region resources
   - Route all traffic to secondary region
   - Provision additional capacity as needed

3. **Service Restoration Prioritization (30-90 minutes)**
   - Restore services in priority order:
     1. Authentication and user management
     2. Core API functionality
     3. Data processing and analytics
     4. Reporting and non-critical features

4. **Data Consistency Verification (90-120 minutes)**
   - Check replication consistency in secondary region
   - Address any data gaps from replication lag
   - Run data integrity validation scripts

5. **Communication and Monitoring (Throughout)**
   - Regular status updates to customers
   - Continuous monitoring of DR environment
   - Capacity planning for extended operation in DR mode

**Recovery Time:** < 2 hours for all critical services, < 4 hours for complete recovery

## Testing and Validation

### DR Testing Schedule

| Test Type | Frequency | Scope | Participants |
|-----------|-----------|-------|-------------|
| Database Failover | Monthly | Automated failover to replicas | DB Team, Automated |
| Read-Only Recovery | Quarterly | Restore backups to read-only environment | DB Team, Ops Team |
| Table-Level Recovery | Quarterly | Restore individual tables from backup | DB Team, Ops Team |
| Regional Failover | Bi-annually | Full failover to DR region | All Teams |
| Full DR Simulation | Annually | Complete recovery from simulated disaster | All Teams, Leadership |

### Validation Procedures

1. **Automated Testing**
   - Health check endpoint validation
   - Data integrity verification
   - Performance benchmarking
   - API functionality testing

2. **Manual Verification**
   - User workflow testing
   - Data consistency review
   - Security compliance check
   - Performance analysis

## Recovery Team and Responsibilities

### Incident Commander

- **Responsibilities**:
  - Overall coordination of the recovery effort
  - Decision-making authority during recovery
  - Communications with leadership and stakeholders

### Database Recovery Team

- **Responsibilities**:
  - Database restoration and verification
  - Data integrity checks
  - Replication management

### Infrastructure Team

- **Responsibilities**:
  - Cloud infrastructure recovery
  - Network configuration
  - Security controls implementation

### Application Team

- **Responsibilities**:
  - Application deployment and configuration
  - Service health verification
  - User-facing functionality testing

### Communications Team

- **Responsibilities**:
  - Status page updates
  - Customer communication
  - Internal stakeholder updates

## Communication Plan

### Internal Communication

| Event | Channel | Audience | Frequency |
|-------|---------|----------|-----------|
| Incident Detection | PagerDuty, Slack | On-call Team | Immediate |
| Initial Assessment | Slack, Video Call | Recovery Team | Within 15 minutes |
| Recovery Updates | Slack, Video Call | All Technical Staff | Every 30 minutes |
| Executive Briefing | Email, Video Call | Leadership | As needed, minimum hourly |

### External Communication

| Event | Channel | Audience | Frequency |
|-------|---------|----------|-----------|
| Initial Notification | Status Page, Email | All Customers | Within 30 minutes |
| Recovery Progress | Status Page, Email | All Customers | Every 1 hour |
| Service Restoration | Status Page, Email, In-app | All Customers | Upon completion |
| Post-Incident Report | Email, Blog | All Customers | Within 48 hours |

## Post-Recovery Procedures

### Incident Review

1. Timeline reconstruction
2. Root cause analysis
3. Recovery process effectiveness assessment
4. Documentation of lessons learned

### Process Improvement

1. Update DR plan based on incident learnings
2. Implement technical improvements to prevent recurrence
3. Enhance monitoring for earlier detection
4. Schedule additional training if needed

### Documentation Update

1. Record incident details and resolution steps
2. Update runbooks with new procedures
3. Revise recovery time estimates based on actual performance
4. Update training materials for recovery teams

## Appendix

### Recovery Runbooks

Detailed step-by-step runbooks are maintained in the operations repository:

- [Database Failover Runbook](https://github.com/bioplatform/ops/runbooks/db-failover.md)
- [Region Failover Runbook](https://github.com/bioplatform/ops/runbooks/region-failover.md)
- [Data Restoration Runbook](https://github.com/bioplatform/ops/runbooks/data-restore.md)
- [Application Recovery Runbook](https://github.com/bioplatform/ops/runbooks/app-recovery.md)

### Contact List

Emergency contacts for all team members and vendors are maintained in the secure operations vault and in printed form in the emergency response kit.

### Vendor SLAs

| Vendor | Service | SLA | Support Contact |
|--------|---------|-----|----------------|
| AWS | Cloud Infrastructure | 99.95% uptime | Priority Support Portal |
| Neon | PostgreSQL | 99.99% uptime | support@neon.tech |
| Cloudflare | CDN & Edge | 100% uptime | 24/7 Enterprise Support |
| PagerDuty | Alerting | 99.99% uptime | support@pagerduty.com |