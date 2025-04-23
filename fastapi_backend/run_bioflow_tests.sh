#!/bin/bash

# Script to run BioFlow-related tests
# This will isolate BioFlow tests from the main test suite

set -e

echo "Running BioFlow tests..."

# Add the current directory to PYTHONPATH
export PYTHONPATH=$PYTHONPATH:$(pwd)

# Run BioFlow-specific tests
python -m pytest tests/test_bioflow_api.py tests/test_bioflow_processor.py -v

# Run BioFlow database connection test
python test_db_connection.py

# Run Biodata component tests
echo "Running Biodata component tests..."
python -m pytest dataprep/biodata/tests/test_analysis_components.py dataprep/biodata/tests/test_analysis_service.py dataprep/biodata/tests/test_processing_queue.py dataprep/biodata/tests/test_result_formatters.py -v

echo "BioFlow tests completed!"
