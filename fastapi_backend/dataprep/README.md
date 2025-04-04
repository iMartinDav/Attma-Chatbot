# Bioinformatics Data Preparation Module

A Python-based module for processing bioinformatics data files, particularly matrix files used in single-cell RNA-seq analysis.

## Features

- Parse matrix file structures (sparse or full matrices)
- Create subsets of large matrices efficiently
- Handle compressed files (gzip, zip, tar.gz)
- Support both local files and remote URLs
- FastAPI integration with endpoints for web-based access
- Nextflow integration for workflow-based data processing

## Usage

### Command Line Interface

The module provides a command-line interface for basic operations:

```bash
# Analyze a matrix file
python -m fastapi_backend.dataprep.cli analyze path/to/matrix.mtx

# Create a subset with 1000 columns
python -m fastapi_backend.dataprep.cli subset path/to/matrix.mtx -n 1000

# List available workflows
python -m fastapi_backend.dataprep.cli workflow-list

# Run a workflow
python -m fastapi_backend.dataprep.cli workflow-run count_matrix --input-file path/to/matrix.mtx
```

### Python API

```python
from fastapi_backend.dataprep.biodata import MatrixStructure, BioinformaticsProcessor, WorkflowRunner

# Analyze a matrix file
matrix = MatrixStructure("path/to/matrix.mtx.gz")
print(matrix)

# Create a subset with 1000 columns
processor = BioinformaticsProcessor("path/to/matrix_dir")
subset_path = processor.generate_matrix_subset(1000)
print(f"Created subset at: {subset_path}")

# Run a workflow
runner = WorkflowRunner()
workflows = runner.list_available_workflows()
print(f"Available workflows: {workflows}")

result = runner.run_workflow("normalize_matrix", {
    "input": "path/to/matrix.mtx",
    "method": "log"
})
print(f"Workflow status: {result['status']}")
print(f"Output files: {result['files']}")
```

### FastAPI Endpoints

The module integrates with FastAPI, providing the following endpoints:

- `POST /dataprep/upload/`: Upload a matrix file
- `POST /dataprep/analyze/`: Analyze a matrix file structure
- `POST /dataprep/subset/`: Create a subset of a matrix
- `GET /dataprep/task/{task_id}/`: Check the status of a processing task
- `GET /dataprep/download/{task_id}/`: Download the result of a processing task
- `GET /dataprep/workflows/`: List available workflows
- `POST /dataprep/workflow/`: Run a workflow on a file
- `GET /dataprep/workflow/{task_id}/`: Check the status of a workflow task
- `GET /dataprep/workflow/{task_id}/result/{file_name}`: Download a specific workflow result file

## File Formats Supported

- `.mtx`: Matrix Market format for sparse matrices
- `.mtx.gz`: Compressed Matrix Market format
- `.zip`: Archive containing matrix files (like Cell Ranger output)
- `.tar.gz`: Archive containing matrix files

## Requirements

- Python 3.8+
- Dependencies: numpy, pandas, scipy, pathlib
- Optional: Nextflow for workflow execution

## Development

### Project Structure

- `biodata/`: Core bioinformatics data processing functionality
  - `matrix_parser.py`: Parses matrix file structures
  - `data_processor.py`: Preprocesses and subsets data
  - `bio_utils.py`: Utility functions for file handling
  - `workflow_runner.py`: Integrates with Nextflow for workflow execution
- `workflows/`: Nextflow workflow definitions
  - `count_matrix.nf`: Counts non-zero values in a matrix
  - `normalize_matrix.nf`: Normalizes matrix values using different methods
- `cli.py`: Command-line interface
- `__init__.py`: Package initialization

### Built-in Workflows

The module comes with several built-in Nextflow workflows:

1. **count_matrix**: Counts non-zero values in a matrix file
   - Parameters: `input` (matrix file path), `output_dir` (results directory)

2. **normalize_matrix**: Normalizes matrix values using different methods
   - Parameters: 
     - `input`: Matrix file path
     - `output_dir`: Results directory
     - `method`: Normalization method (log, tpm, zscore)

### Testing

Tests can be run using pytest:

```bash 
pytest fastapi_backend/dataprep/tests/
```