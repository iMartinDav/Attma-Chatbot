#!/usr/bin/env python3
"""
Centralized test runner for the FastAPI backend.

This script provides a unified interface for running all types of tests in the project:
- Unit tests
- Integration tests
- API tests
- Bioflow specific tests

Usage:
    python -m commands.run_tests [OPTIONS]

Options:
    --scope TEXT          Test scope to run: all, unit, integration, api, bioflow (default: all)
    --verbose             Enable verbose output
    --coverage            Generate coverage report
    --docker              Run tests in Docker container instead of locally
    --watch               Run tests in watch mode (rerun on file changes)
    --failfast            Stop on first failure
    --use-uv              Use UV for running tests instead of standard Python (faster)
    --env-override TEXT   Override environment variables (format: "KEY1=value1 KEY2=value2")
    --help                Show this help message

Examples:
    python -m commands.run_tests --scope unit
    python -m commands.run_tests --scope bioflow --verbose
    python -m commands.run_tests --coverage --docker
    python -m commands.run_tests --use-uv --scope api
    python -m commands.run_tests --env-override "DATABASE_URL=postgresql://user:pass@host/db"
"""

import argparse
import os
import subprocess
import sys
import shlex
from pathlib import Path
from dotenv import load_dotenv


BASE_DIR = Path(__file__).parent.parent
TEST_DIR = BASE_DIR / "tests"

# Load test environment variables if available
def load_env_files(env_overrides=None):
    """
    Load appropriate environment files for testing.
    
    Args:
        env_overrides: String of environment variables to override in format "KEY1=value1 KEY2=value2"
    """
    # First priority: .env.test for test-specific configuration
    test_env_path = BASE_DIR / ".env.test"
    if test_env_path.exists():
        load_dotenv(test_env_path, override=True)
        print(f"Loaded test environment from {test_env_path}")
    
    # Second priority: .env for general configuration 
    env_path = BASE_DIR / ".env"
    if env_path.exists():
        load_dotenv(env_path, override=False)  # Don't override .env.test values
        print(f"Loaded base environment from {env_path}")
    
    # Always set testing mode
    os.environ["TESTING"] = "True"
    
    # Apply any command-line environment overrides (highest priority)
    if env_overrides:
        # Split the string by spaces respecting quotes
        env_items = shlex.split(env_overrides)
        for item in env_items:
            if "=" in item:
                key, value = item.split("=", 1)
                os.environ[key] = value
                print(f"Overriding environment variable: {key}")


def in_docker():
    """Check if code is running inside Docker container."""
    return os.path.exists('/.dockerenv')


def get_test_paths(scope, for_docker=False):
    """Get the test files/directories based on the scope."""
    # In Docker container, tests are located at /app/tests/
    base_path = "/app" if for_docker else str(BASE_DIR)
    
    if scope == "all":
        return [f"{base_path}/tests"]
    
    # Define test paths based on scope
    scope_paths = {
        "unit": ["tests/unit"],
        "integration": ["tests/integration", "tests/test_drizzle.py", "tests/test_database.py"],
        "api": ["tests/api", "tests/routes"],
        "bioflow": ["tests/test_bioflow_api.py", "tests/test_bioflow_processor.py"],
    }
    
    # Add general directories if they don't exist yet
    if not (TEST_DIR / "unit").exists():
        scope_paths["unit"].append("tests")
    if not (TEST_DIR / "integration").exists():
        scope_paths["integration"].append("tests")
    if not (TEST_DIR / "api").exists():
        scope_paths["api"].append("tests/routes")
    
    if scope in scope_paths:
        return [f"{base_path}/{path}" for path in scope_paths[scope]]
    
    print(f"Error: Unknown test scope '{scope}'")
    sys.exit(1)


def check_for_uv():
    """Check if UV is installed and available."""
    try:
        result = subprocess.run(["which", "uv"], capture_output=True, text=True)
        return result.returncode == 0 and result.stdout.strip() != ""
    except:
        return False


def run_tests_in_container(args):
    """Run tests inside Docker container."""
    cmd = ["docker", "exec", "fastapi-backend"]
    
    # Use UV if specified and available in the container
    if args.use_uv:
        # Check if UV is available in the container
        uv_check = subprocess.run(
            ["docker", "exec", "fastapi-backend", "which", "uv"], 
            capture_output=True, 
            text=True
        )
        if uv_check.returncode == 0:
            cmd.extend(["uv", "run", "pytest"])
        else:
            print("Warning: UV not found in container, falling back to Python")
            cmd.extend(["python", "-m", "pytest"])
    else:
        cmd.extend(["python", "-m", "pytest"])
    
    test_paths = get_test_paths(args.scope, for_docker=True)
    cmd.extend(test_paths)
    
    # Add pytest arguments
    if args.verbose:
        cmd.append("-v")
    if args.coverage:
        cmd.append("--cov=app")
        cmd.append("--cov-report=term")
        cmd.append("--cov-report=html:coverage_html")
    if args.failfast:
        cmd.append("--exitfirst")
    
    print(f"Running tests in Docker container: {' '.join(cmd)}")
    return subprocess.call(cmd)


def run_tests_locally(args):
    """Run tests locally using pytest."""
    # Use UV if specified and available
    if args.use_uv and check_for_uv():
        cmd = ["uv", "run", "pytest"]
    else:
        python_cmd = "python3" if os.system("which python3 > /dev/null") == 0 else "python"
        cmd = [python_cmd, "-m", "pytest"]
    
    test_paths = get_test_paths(args.scope)
    cmd.extend(test_paths)
    
    # Add pytest arguments
    if args.verbose:
        cmd.append("-v")
    if args.coverage:
        cmd.append("--cov=app")
        cmd.append("--cov-report=term")
        cmd.append("--cov-report=html:coverage_html")
    if args.failfast:
        cmd.append("--exitfirst")
    if args.watch:
        cmd.append("--watch")
    
    print(f"Running tests locally: {' '.join(cmd)}")
    return subprocess.call(cmd)


def main():
    """Main function to parse arguments and run tests."""
    parser = argparse.ArgumentParser(description="Run FastAPI backend tests")
    parser.add_argument(
        "--scope",
        default="all",
        choices=["all", "unit", "integration", "api", "bioflow"],
        help="Test scope to run"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose output"
    )
    parser.add_argument(
        "--coverage",
        action="store_true",
        help="Generate coverage report"
    )
    parser.add_argument(
        "--docker",
        action="store_true",
        help="Run tests in Docker container"
    )
    parser.add_argument(
        "--watch",
        action="store_true",
        help="Run tests in watch mode (rerun on file changes)"
    )
    parser.add_argument(
        "--failfast",
        action="store_true",
        help="Stop on first failure"
    )
    parser.add_argument(
        "--use-uv",
        action="store_true",
        help="Use UV for running tests (faster package manager)"
    )
    parser.add_argument(
        "--env-override",
        help="Override environment variables (format: \"KEY1=value1 KEY2=value2\")"
    )
    
    args = parser.parse_args()
    
    # Load environment variables for testing with any overrides
    load_env_files(args.env_override)
    
    # If --docker is provided or we're already in Docker, run in container
    if args.docker and not in_docker():
        return run_tests_in_container(args)
    else:
        return run_tests_locally(args)


if __name__ == "__main__":
    sys.exit(main())
