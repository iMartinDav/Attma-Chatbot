"""
Bioinformatics Workflow Runner.

This module provides functionality to execute bioinformatics workflows
using Nextflow for matrix data analysis.
"""

import os
import json
import logging
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional, List, Union

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class WorkflowError(Exception):
    """Exception raised for errors in workflow execution."""
    pass


class WorkflowRunner:
    """
    Run bioinformatics workflows using Nextflow.
    
    This class provides methods to execute Nextflow workflows with
    specified parameters and monitor their execution.
    
    Attributes:
        workflows_dir (Path): Directory containing workflow scripts
    """
    
    def __init__(self, workflows_dir: Union[str, Path] = None):
        """
        Initialize a WorkflowRunner.
        
        Args:
            workflows_dir: Directory containing workflow scripts
                (defaults to the 'workflows' directory within the dataprep module)
        """
        if workflows_dir is None:
            # Default to the 'workflows' directory within the dataprep module
            module_dir = Path(__file__).parent.parent
            workflows_dir = module_dir / "workflows"
        
        self.workflows_dir = Path(workflows_dir)
        
        # Ensure Nextflow is available
        try:
            subprocess.run(["nextflow", "-version"], 
                         stdout=subprocess.PIPE, 
                         stderr=subprocess.PIPE, 
                         check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            logger.warning("Nextflow not found in PATH. Some functionality may be limited.")
    
    def run_workflow(self, workflow_name: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Run a Nextflow workflow with the specified parameters.
        
        Args:
            workflow_name: Name of the workflow (e.g., 'count_matrix')
            params: Parameters to pass to the workflow
            
        Returns:
            Dictionary with workflow results:
            - output_dir: Path to the output directory
            - status: Success or failure
            - message: Any relevant messages
            
        Raises:
            WorkflowError: If the workflow execution fails
        """
        if not params:
            params = {}
        
        workflow_path = self.workflows_dir / f"{workflow_name}.nf"
        if not workflow_path.exists():
            raise WorkflowError(f"Workflow not found: {workflow_name}")
        
        # Create output directory if not specified
        if 'output_dir' not in params:
            output_dir = tempfile.mkdtemp(prefix=f"nextflow_results_{workflow_name}_")
            params['output_dir'] = output_dir
        else:
            output_dir = params['output_dir']
            os.makedirs(output_dir, exist_ok=True)
        
        # Create parameter file
        params_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
        json.dump(params, params_file)
        params_file.close()
        
        result = {
            'output_dir': output_dir,
            'status': 'failed',
            'message': '',
            'workflow': workflow_name
        }
        
        try:
            # Build Nextflow command
            cmd = ["nextflow", "run", str(workflow_path), "-params-file", params_file.name]
            
            # Execute Nextflow
            logger.info(f"Executing Nextflow workflow: {' '.join(cmd)}")
            process = subprocess.Popen(
                cmd, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE,
                universal_newlines=True
            )
            
            stdout, stderr = process.communicate()
            
            if process.returncode != 0:
                error_msg = f"Nextflow workflow failed: {stderr}"
                logger.error(error_msg)
                result['message'] = error_msg
                raise WorkflowError(error_msg)
            
            # Success case
            result['status'] = 'success'
            result['message'] = 'Workflow completed successfully'
            logger.info(f"Nextflow workflow completed successfully: {workflow_name}")
            
            # Process workflow output files
            result_files = {}
            for file_path in Path(output_dir).glob('**/*'):
                if file_path.is_file():
                    rel_path = file_path.relative_to(output_dir)
                    result_files[str(rel_path)] = str(file_path)
            
            result['files'] = result_files
            return result
        
        except Exception as e:
            if not isinstance(e, WorkflowError):
                error_msg = f"Error executing Nextflow workflow: {str(e)}"
                logger.error(error_msg)
                result['message'] = error_msg
                raise WorkflowError(error_msg)
            raise
        
        finally:
            # Clean up parameter file
            try:
                os.unlink(params_file.name)
            except:
                pass
    
    def list_available_workflows(self) -> List[str]:
        """
        List all available workflows.
        
        Returns:
            List of workflow names (without the .nf extension)
        """
        workflows = []
        for path in self.workflows_dir.glob('*.nf'):
            workflows.append(path.stem)
        
        return workflows


if __name__ == "__main__":
    # Example usage
    runner = WorkflowRunner()
    available_workflows = runner.list_available_workflows()
    print(f"Available workflows: {available_workflows}")
    
    if "count_matrix" in available_workflows:
        print("Running count_matrix workflow...")
        result = runner.run_workflow("count_matrix", {"input": "path/to/matrix.mtx"})
        print(f"Workflow status: {result['status']}")
        print(f"Output directory: {result['output_dir']}")
        if 'files' in result:
            print("Output files:")
            for name, path in result['files'].items():
                print(f"  {name}: {path}")
    else:
        print("count_matrix workflow not found") 