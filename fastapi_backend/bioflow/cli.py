#!/usr/bin/env python3
"""
Command Line Interface for the BioFlow Bioinformatics module.

This script provides command-line functionality for analyzing and
processing bioinformatics data files and executing scientific workflows.
"""

import argparse
import sys
import logging
import json
from pathlib import Path

from .biodata import MatrixStructure, BioinformaticsProcessor, WorkflowRunner


def setup_logging(verbose=False):
    """Set up logging configuration."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler(sys.stdout)]
    )


def analyze_matrix(args):
    """Analyze a matrix file and print its structure."""
    try:
        matrix = MatrixStructure(args.input_file)
        print(matrix)
        return 0
    except Exception as e:
        print(f"Error analyzing matrix: {str(e)}", file=sys.stderr)
        return 1


def subset_matrix(args):
    """Create a subset of a matrix file."""
    try:
        processor = BioinformaticsProcessor(args.input_file)
        subset_path = processor.generate_matrix_subset(args.num_columns)
        
        if subset_path:
            print(f"Successfully created subset with {args.num_columns} columns at: {subset_path}")
            return 0
        else:
            print("Failed to create subset", file=sys.stderr)
            return 1
    except Exception as e:
        print(f"Error creating subset: {str(e)}", file=sys.stderr)
        return 1


def list_workflows(args):
    """List available workflows."""
    try:
        runner = WorkflowRunner(args.workflows_dir)
        workflows = runner.list_available_workflows()
        
        if workflows:
            print("Available workflows:")
            for workflow in workflows:
                print(f"  - {workflow}")
        else:
            print("No workflows found in the specified directory")
        
        return 0
    except Exception as e:
        print(f"Error listing workflows: {str(e)}", file=sys.stderr)
        return 1


def run_workflow(args):
    """Run a workflow with specified parameters."""
    try:
        # Parse parameters from JSON file or command line
        params = {}
        if args.params_file:
            with open(args.params_file, 'r') as f:
                params = json.load(f)
        
        # Add input file to parameters if provided
        if args.input_file:
            params['input'] = args.input_file
        
        # Add output directory to parameters if provided
        if args.output_dir:
            params['output_dir'] = args.output_dir
        
        # Initialize workflow runner
        runner = WorkflowRunner(args.workflows_dir)
        
        # Run the workflow
        print(f"Running workflow: {args.workflow_name}")
        print(f"Parameters: {json.dumps(params, indent=2)}")
        
        result = runner.run_workflow(args.workflow_name, params)
        
        # Print results
        print(f"Workflow status: {result['status']}")
        print(f"Output directory: {result['output_dir']}")
        
        if result['status'] == 'success' and 'files' in result:
            print("Output files:")
            for name, path in result['files'].items():
                print(f"  - {name}: {path}")
        
        return 0 if result['status'] == 'success' else 1
    except Exception as e:
        print(f"Error running workflow: {str(e)}", file=sys.stderr)
        return 1


def main():
    """Main entry point for the CLI."""
    parser = argparse.ArgumentParser(
        description="BioFlow: Bioinformatics workflow tools"
    )
    parser.add_argument('-v', '--verbose', action='store_true', help='Enable verbose output')
    
    subparsers = parser.add_subparsers(title='commands', help='Available commands')
    
    # Analyze matrix command
    analyze_parser = subparsers.add_parser('analyze', help='Analyze a matrix file structure')
    analyze_parser.add_argument('input_file', help='Path to the input matrix file')
    analyze_parser.set_defaults(func=analyze_matrix)
    
    # Subset matrix command
    subset_parser = subparsers.add_parser('subset', help='Create a subset of a matrix file')
    subset_parser.add_argument('input_file', help='Path to the input matrix file or directory')
    subset_parser.add_argument('-n', '--num-columns', type=int, required=True,
                              help='Number of columns to include in the subset')
    subset_parser.set_defaults(func=subset_matrix)
    
    # List workflows command
    workflow_list_parser = subparsers.add_parser('workflow-list', help='List available workflows')
    workflow_list_parser.add_argument('--workflows-dir', 
                                     help='Directory containing workflow files')
    workflow_list_parser.set_defaults(func=list_workflows)
    
    # Run workflow command
    workflow_run_parser = subparsers.add_parser('workflow-run', help='Run a workflow')
    workflow_run_parser.add_argument('workflow_name', help='Name of the workflow to run')
    workflow_run_parser.add_argument('--input-file', help='Input file for the workflow')
    workflow_run_parser.add_argument('--output-dir', help='Output directory for results')
    workflow_run_parser.add_argument('--params-file', help='JSON file with workflow parameters')
    workflow_run_parser.add_argument('--workflows-dir', 
                                    help='Directory containing workflow files')
    workflow_run_parser.set_defaults(func=run_workflow)
    
    args = parser.parse_args()
    setup_logging(args.verbose)
    
    if hasattr(args, 'func'):
        return args.func(args)
    else:
        parser.print_help()
        return 0


if __name__ == '__main__':
    sys.exit(main()) 