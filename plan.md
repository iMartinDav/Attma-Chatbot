# BioFlow Project Integration Plan

## Project Overview

BioFlow is a bioinformatics platform that combines modern web technologies with advanced biological data analysis capabilities. The project integrates a Next.js frontend with a FastAPI backend to create a seamless environment for bioinformatics analysis, data visualization, and AI-assisted research.

## Integration Goals

This plan focuses on creating a seamless flow between the frontend file upload component and backend bioinformatics processing, with proper artifact generation and persistent storage of analysis results.

## System Architecture

### Frontend (Next.js 15+)
- **Technology Stack**: Next.js 15+, TypeScript, Tailwind CSS, Shadcn UI, Radix UI
- **Key Features**:
  - File upload component for bioinformatics data
  - Artifact-based visualizations for analysis results
  - Interactive analysis tools via artifact interfaces

### Backend (FastAPI)
- **Technology Stack**: Python 3.11+, FastAPI, PostgreSQL (Neon)
- **Key Features**:
  - Bioinformatics data processing pipeline
  - Analysis execution engine
  - Artifact generation for frontend visualization
  - Result persistence in Vercel Blob Storage and/or Neon PostgreSQL

### Data Flow
1. User uploads bioinformatics files through frontend
2. Files are sent to FastAPI backend
3. Backend processes data through `dataprep` module
4. Analysis results are stored in Neon PostgreSQL/Vercel Blob
5. Results are returned as artifacts to frontend
6. Frontend displays results in appropriate artifact format (tables, graphs)

## Implementation Plan

### Phase 1: File Upload Enhancement (Week 1)
1. **Task 1.1:** Extend multimodal-input.tsx to identify bioinformatics file types
   - Add detection for common bioinformatics formats (.fastq, .bam, .vcf, etc.)
   - Create specialized upload handler for bioinformatics files
   
2. **Task 1.2:** Create FastAPI endpoint for bioinformatics file uploads
   - Implement file validation for bioinformatics data
   - Set up temporary storage for uploaded files in processing pipeline

3. **Task 1.3:** Implement file tracking system
   - Create database schema for tracking uploaded bioinformatics files
   - Implement status monitoring for file processing

### Phase 2: Backend Processing Pipeline (Week 2)
1. **Task 2.1:** Enhance dataprep module for file processing
   - Implement robust error handling for various file formats
   - Create processing queue for large datasets
   
2. **Task 2.2:** Implement analysis execution framework
   - Create modular analysis components for different bioinformatics processes
   - Implement logging and monitoring for analysis jobs
   
3. **Task 2.3:** Create output formatters for analysis results
   - Implement data transformers for different visualization types
   - Create serializers for artifact integration

### Phase 3: Data Persistence Layer (Week 3)
1. **Task 3.1:** Migrate from S3 to Vercel Blob Storage
   - Configure Blob Storage connection
   - Implement upload/download utilities for analysis results
   
2. **Task 3.2:** Set up Neon PostgreSQL for analysis metadata
   - Design schema for analysis results and metadata
   - Implement DAL (Data Access Layer) for persistent storage
   
3. **Task 3.3:** Create background processing system
   - Implement async processing for long-running analyses
   - Create job status monitoring system

### Phase 4: Artifact Integration (Week 4)
1. **Task 4.1:** Create Graph Artifact
   - Implement client-side component for graph visualization
   - Create server-side handler for graph data generation
   
2. **Task 4.2:** Enhance Existing Sheet Artifact for Bioinformatics Data
   - Extend the Sheet artifact to handle specialized bioinformatics data formats
   - Add bioinformatics-specific features (e.g., gene filtering, pathway highlighting)
   
3. **Task 4.3:** Connect artifacts to analysis results
   - Create mapping system between analysis types and artifact formats
   - Implement automatic artifact selection based on result type

### Phase 5: Testing and Integration (Week 5)
1. **Task 5.1:** Create integration tests
   - Test full data flow from upload to visualization
   - Implement comprehensive edge case testing
   
2. **Task 5.2:** Performance optimization
   - Optimize large file handling
   - Implement caching for repeated analyses
   
3. **Task 5.3:** Documentation
   - Create developer documentation for extending the pipeline
   - Document artifact API for creating new visualizations

## Detailed Implementation Specifications

### Bioinformatics File Upload Flow

1. Frontend detects bioinformatics file type (zip, fastq, etc.)
2. File is sent to specialized `/api/bioflow/upload` endpoint
3. Backend validates file and creates processing job
4. Job ID is returned to frontend for status tracking
5. Frontend polls job status until complete
6. Analysis results trigger artifact creation

### Data Persistence Strategy

1. **Analysis Results Storage:**
   - Small results (<1MB): Store directly in Neon PostgreSQL
   - Large results (>=1MB): Store in Vercel Blob Storage with reference in PostgreSQL
   
2. **Database Schema:**
   ```sql
   CREATE TABLE analysis_results (
     id UUID PRIMARY KEY,
     user_id UUID NOT NULL,
     analysis_type VARCHAR(255) NOT NULL,
     created_at TIMESTAMP NOT NULL,
     metadata JSONB,
     small_result JSONB,
     large_result_blob_id VARCHAR(255)
   );
   ```

3. **Blob Storage Organization:**
   - Path format: `users/{user_id}/analyses/{analysis_id}/{artifact_type}`
   - Metadata stored alongside blobs for quick retrieval

### New Artifacts Implementation

1. **Graph Artifact:**
   - Client-side: Interactive visualization using D3.js or Plotly
   - Server-side: Data transformer for various graph formats
   
2. **Bioinformatics Table Artifact:**
   - Client-side: Enhanced table with filtering and exploration features
   - Server-side: Data pagination and filtering support

## Testing Strategy

For each development phase, implement:
1. Unit tests for individual components
2. Integration tests for data flow
3. End-to-end tests for complete user journeys

## Development Workflow

1. For each task:
   - Create feature branch from main
   - Implement functionality
   - Write tests
   - Create PR with detailed description
   - Code review
   - Merge after approval and passing tests

2. Git commit strategy:
   - Commit after completing each logical unit of work
   - Use conventional commit messages: `feat:`, `fix:`, `docs:`, etc.
   - Include task reference in commit message

## Monitoring and Deployment

1. Implement logging throughout the pipeline
2. Create monitoring dashboard for analysis jobs
3. Set up alerts for failed jobs and system errors
4. Deploy in phases, starting with non-critical components
