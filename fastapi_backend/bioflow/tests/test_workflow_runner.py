"""
Tests for the workflow_runner module.
"""

import os
import pytest
import tempfile
import shutil
from pathlib import Path
import json

from ..biodata.workflow_runner import WorkflowRunner, WorkflowError


def create_test_workflow_dir():
    """Create a test directory with a workflow file."""
    temp_dir = tempfile.mkdtemp()
    
    # Create a simple test workflow file
    with open(os.path.join(temp_dir, "test_workflow.nf"), "w") as f:
        f.write("""#!/usr/bin/env nextflow

// Parameters
params.message = "Hello World"
params.output_dir = "results"

process sayHello {
    publishDir params.output_dir, mode: 'copy'
    
    output:
    path "output.txt" into results
    
    script:
    """\"
    echo "${params.message}" > output.txt
    """\"
}

workflow {
    sayHello()
}
""")
    
    return temp_dir


def test_workflow_runner_initialization():
    """Test WorkflowRunner initialization with custom directory."""
    workflow_dir = create_test_workflow_dir()
    try:
        runner = WorkflowRunner(workflow_dir)
        
        assert runner.workflows_dir == Path(workflow_dir)
        assert "test_workflow" in runner.list_available_workflows()
    finally:
        shutil.rmtree(workflow_dir)


def test_list_available_workflows():
    """Test listing available workflows."""
    workflow_dir = create_test_workflow_dir()
    try:
        runner = WorkflowRunner(workflow_dir)
        workflows = runner.list_available_workflows()
        
        assert isinstance(workflows, list)
        assert "test_workflow" in workflows
    finally:
        shutil.rmtree(workflow_dir)


@pytest.mark.skipif(
    os.system("nextflow -version >/dev/null 2>&1") != 0,
    reason="Nextflow not installed"
)
def test_run_workflow():
    """Test running a workflow (requires Nextflow installed)."""
    workflow_dir = create_test_workflow_dir()
    try:
        runner = WorkflowRunner(workflow_dir)
        
        # Create temp output directory
        output_dir = tempfile.mkdtemp()
        
        # Set custom parameters
        params = {
            "message": "Testing Nextflow Integration",
            "output_dir": output_dir
        }
        
        # Run workflow (this will be skipped if Nextflow is not installed)
        result = runner.run_workflow("test_workflow", params)
        
        # Verify result structure
        assert result["status"] == "success"
        assert result["workflow"] == "test_workflow"
        assert "files" in result
        assert "output.txt" in result["files"]
        
        # Verify output file content
        output_file = Path(output_dir) / "output.txt"
        assert output_file.exists()
        
        with open(output_file, "r") as f:
            content = f.read().strip()
            assert content == "Testing Nextflow Integration"
    
    finally:
        shutil.rmtree(workflow_dir)
        if "output_dir" in locals():
            shutil.rmtree(output_dir)


def test_workflow_not_found():
    """Test error handling when workflow is not found."""
    workflow_dir = create_test_workflow_dir()
    try:
        runner = WorkflowRunner(workflow_dir)
        
        with pytest.raises(WorkflowError) as excinfo:
            runner.run_workflow("nonexistent_workflow")
        
        assert "Workflow not found" in str(excinfo.value)
    
    finally:
        shutil.rmtree(workflow_dir) 