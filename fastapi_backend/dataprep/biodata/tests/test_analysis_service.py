"""
Unit tests for the analysis service integration.
"""

import unittest
import os
import json
import tempfile
import time
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock

from ..analysis_service import (
    AnalysisService, AnalysisError, get_analysis_service
)
from ..processing_queue import (
    JobPriority, JobStatus, ProcessingJob
)
from ..analysis_components import AnalysisType, AnalysisResult

class TestAnalysisService(unittest.TestCase):
    """Test cases for the Analysis Service integration."""
    
    def setUp(self):
        """Set up test fixtures."""
        # Create temporary directories for workflows and results
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workflows_dir = Path(self.temp_dir.name) / "workflows"
        self.results_dir = Path(self.temp_dir.name) / "results"
        os.makedirs(self.workflows_dir, exist_ok=True)
        os.makedirs(self.results_dir, exist_ok=True)
        
        # Create test input data
        self.test_data_dir = Path(self.temp_dir.name) / "data"
        os.makedirs(self.test_data_dir, exist_ok=True)
        
        # Create a small CSV file for testing
        self.test_file = Path(self.test_data_dir) / "test_matrix.csv"
        with open(self.test_file, 'w') as f:
            f.write("gene,cell1,cell2,cell3\n")
            f.write("gene1,1.0,2.0,3.0\n")
            f.write("gene2,4.0,5.0,6.0\n")
            f.write("gene3,7.0,8.0,9.0\n")
        
        # Create the analysis service with test directories
        self.service = AnalysisService(
            workflows_dir=self.workflows_dir,
            results_dir=self.results_dir,
            max_workers=1  # Use only one worker for tests
        )

    def tearDown(self):
        """Clean up test fixtures."""
        # Stop the service queue
        self.service.shutdown()
        
        # Remove temporary directory and contents
        self.temp_dir.cleanup()

    def test_service_initialization(self):
        """Test that the service initializes correctly."""
        # Check that service components are initialized
        self.assertIsNotNone(self.service.queue)
        self.assertIsNotNone(self.service.workflow_runner)
        self.assertIsNotNone(self.service.analysis_registry)
        self.assertIsNotNone(self.service.formatter_registry)
        
        # Check that directories are set correctly
        self.assertEqual(self.service.workflows_dir, self.workflows_dir)
        self.assertEqual(self.service.results_dir, self.results_dir)

    def test_submit_analysis(self):
        """Test submitting an analysis job."""
        # Submit a matrix stats analysis job
        job_id = self.service.submit_analysis(
            analysis_type=AnalysisType.MATRIX_STATS,
            params={"input": str(self.test_file)},
            priority=JobPriority.HIGH
        )
        
        # Check that we got a job ID
        self.assertIsNotNone(job_id)
        
        # Wait for job to complete (timeout after 5 seconds)
        start_time = time.time()
        status = None
        while time.time() - start_time < 5:
            job_status = self.service.get_job_status(job_id)
            if job_status:
                status = job_status.get("status")
                if status == JobStatus.COMPLETED.value or status == JobStatus.FAILED.value:
                    break
            time.sleep(0.1)
        
        # Check that job completed successfully
        self.assertEqual(status, JobStatus.COMPLETED.value)
        
        # Get the job result
        job_result = self.service.get_job_status(job_id)
        
        # Check that result is as expected
        self.assertIn("result", job_result)
        result = job_result.get("result", {})
        
        # Verify result contains expected data
        self.assertIn("analysis_type", result)
        self.assertEqual(result["analysis_type"], "MATRIX_STATS")
        self.assertIn("result_data", result)
        self.assertIn("mean", result["result_data"])
        
        # Verify statistics match expected values for our test file
        self.assertAlmostEqual(result["result_data"]["mean"], 5.0)  # Mean of 1-9
        self.assertAlmostEqual(result["result_data"]["max"], 9.0)   # Max value
        self.assertAlmostEqual(result["result_data"]["min"], 1.0)   # Min value

    def test_format_result(self):
        """Test formatting analysis results."""
        # Create a test analysis result
        result_data = {
            "analysis_type": "MATRIX_STATS",
            "result_data": {
                "mean": 5.0,
                "std": 2.5,
                "min": 1.0,
                "max": 9.0
            },
            "metadata": {
                "rows": 3,
                "columns": 3,
                "source_file": "test_matrix.csv"
            }
        }
        
        # Format as table
        formatted = self.service.format_result(
            result_data=result_data,
            format_name="table",
            format_type="grid"
        )
        
        # Check formatting succeeded
        self.assertEqual(formatted["status"], "success")
        self.assertIn("formatted_result", formatted)
        
        # Verify table format
        table_result = formatted["formatted_result"]
        self.assertEqual(table_result["format_type"], "TABLE")
        self.assertIn("headers", table_result["data"])
        self.assertIn("rows", table_result["data"])
        
        # Format as chart
        formatted = self.service.format_result(
            result_data=result_data,
            format_name="chart",
            format_type="bar"
        )
        
        # Check formatting succeeded
        self.assertEqual(formatted["status"], "success")
        self.assertIn("formatted_result", formatted)
        
        # Verify chart format
        chart_result = formatted["formatted_result"]
        self.assertEqual(chart_result["format_type"], "CHART")
        self.assertEqual(chart_result["data"]["chart_type"], "bar")

    def test_async_format_result(self):
        """Test asynchronous formatting of results."""
        # Create a test analysis result
        result_data = {
            "analysis_type": "CLUSTERING",
            "result_data": {
                "clusters": [0, 1, 0],
                "cluster_centers": [[1, 2], [3, 4]]
            },
            "metadata": {
                "algorithm": "kmeans",
                "n_clusters": 2
            }
        }
        
        # Format asynchronously
        job_id = self.service.format_result(
            result_data=result_data,
            format_name="graph",
            async_processing=True
        )
        
        # Check that we got a job ID
        self.assertIsNotNone(job_id)
        
        # Wait for job to complete (timeout after 5 seconds)
        start_time = time.time()
        status = None
        while time.time() - start_time < 5:
            job_status = self.service.get_job_status(job_id)
            if job_status:
                status = job_status.get("status")
                if status == JobStatus.COMPLETED.value or status == JobStatus.FAILED.value:
                    break
            time.sleep(0.1)
        
        # Check that job completed
        self.assertEqual(status, JobStatus.COMPLETED.value)
        
        # Get the job result
        job_result = self.service.get_job_status(job_id)
        
        # Check that result is as expected
        self.assertIn("result", job_result)
        result = job_result.get("result", {})
        
        # Verify result contains formatted data
        self.assertIn("formatted_result", result)
        graph = result["formatted_result"]
        self.assertEqual(graph["format_type"], "GRAPH")
        self.assertIn("nodes", graph["data"])
        self.assertIn("edges", graph["data"])

    def test_queue_statistics(self):
        """Test retrieving queue statistics."""
        # Submit a few jobs to populate the queue
        job_ids = []
        for _ in range(3):
            job_id = self.service.submit_analysis(
                analysis_type=AnalysisType.MATRIX_STATS,
                params={"input": str(self.test_file)}
            )
            job_ids.append(job_id)
        
        # Get queue stats
        stats = self.service.get_queue_stats()
        
        # Check stats structure
        self.assertIn("pending", stats)
        self.assertIn("active", stats)
        self.assertIn("completed", stats)
        self.assertIn("failed", stats)
        
        # Wait for jobs to complete
        start_time = time.time()
        while time.time() - start_time < 5:
            # Check if all jobs are done
            all_done = True
            for job_id in job_ids:
                job_status = self.service.get_job_status(job_id)
                if job_status:
                    status = job_status.get("status")
                    if status != JobStatus.COMPLETED.value and status != JobStatus.FAILED.value:
                        all_done = False
                        break
            if all_done:
                break
            time.sleep(0.1)
        
        # Get updated stats
        stats = self.service.get_queue_stats()
        
        # Check that jobs completed
        self.assertEqual(stats["completed"], 3)

    def test_list_available_components(self):
        """Test listing available analysis types and formatters."""
        # List available analysis types
        analysis_types = self.service.list_available_analysis_types()
        
        # Check that we have expected analysis types
        self.assertGreaterEqual(len(analysis_types), 3)
        analysis_names = [a["analysis_type"] for a in analysis_types]
        self.assertIn("MATRIX_STATS", analysis_names)
        self.assertIn("CLUSTERING", analysis_names)
        self.assertIn("DIMENSION_REDUCTION", analysis_names)
        
        # List available formatters
        formatters = self.service.list_available_formatters()
        
        # Check that we have expected formatters
        self.assertGreaterEqual(len(formatters), 3)
        self.assertIn("TABLE", formatters)
        self.assertIn("GRAPH", formatters)
        self.assertIn("CHART", formatters)

    def test_get_analysis_service_singleton(self):
        """Test the singleton pattern for the analysis service."""
        # Get the singleton instance
        service1 = get_analysis_service()
        
        # Get it again
        service2 = get_analysis_service()
        
        # Check that both are the same instance
        self.assertIs(service1, service2)
        
        # Stop the service to cleanup
        service1.shutdown()

    @patch('asyncio.create_task')
    def test_error_handling(self, mock_create_task):
        """Test error handling in the analysis service."""
        # Mock the processing queue to raise an error
        self.service.queue.submit_job = MagicMock(side_effect=ValueError("Test error"))
        
        # Try to submit an analysis
        with self.assertRaises(ValueError):
            self.service.submit_analysis(
                analysis_type=AnalysisType.MATRIX_STATS,
                params={"input": "invalid_file.csv"}
            )
        
        # Check missing parameters handling
        with self.assertRaises(ValueError):
            self.service.format_result(
                result_data=None,
                format_name="table"
            )
        
        # Try formatting an invalid result
        result = self.service.format_result(
            result_data={"invalid": "data"},
            format_name="table"
        )
        self.assertEqual(result["status"], "error")
        self.assertIn("error", result)


if __name__ == '__main__':
    unittest.main()