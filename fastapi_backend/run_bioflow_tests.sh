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

echo "BioFlow tests completed!"
