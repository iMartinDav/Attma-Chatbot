-- Bioflow module database schema

-- Table for tracking uploaded bioinformatics files
CREATE TABLE IF NOT EXISTS uploaded_files (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    original_filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    content_type TEXT NOT NULL,
    storage_type TEXT NOT NULL DEFAULT 'local',
    storage_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for tracking analysis jobs
CREATE TABLE IF NOT EXISTS analysis_jobs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
    status TEXT NOT NULL, -- 'queued', 'processing', 'completed', 'failed'
    file_name TEXT NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing analysis results
CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    analysis_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,  -- Store file metadata as JSON
    result_type TEXT NOT NULL,  -- 'table', 'plot', 'text', etc.
    storage_type TEXT NOT NULL, -- 'database', 's3', etc.
    result_location TEXT,  -- Path or URL if stored externally
    small_result JSONB,  -- Small results stored directly in the database
    large_result_blob_id UUID  -- Reference to a large result blob
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_id ON uploaded_files(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_id ON analysis_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_file_id ON analysis_jobs(file_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_user_id ON analysis_results(user_id);