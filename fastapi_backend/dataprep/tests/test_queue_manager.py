"""
Unit tests for the data processing queue manager.
"""

import unittest
import tempfile
import os
import time
import json
from unittest.mock import MagicMock, patch
import threading

from dataprep.biodata.queue_manager import (
    ProcessingQueue, Task, TaskStatus, QueueManager, 
    ProcessingWorker, TaskPriority
)


class TestProcessingQueue(unittest.TestCase):
    """Test the processing queue implementation."""

    def setUp(self):
        """Set up test fixtures before each test method is run."""
        # Create a temporary directory for the queue storage
        self.temp_dir = tempfile.mkdtemp()
        self.queue = ProcessingQueue(storage_path=self.temp_dir)
        
    def tearDown(self):
        """Tear down test fixtures after each test method is run."""
        # Remove temp files
        for root, dirs, files in os.walk(self.temp_dir):
            for file in files:
                os.unlink(os.path.join(root, file))
        os.rmdir(self.temp_dir)
        
    def test_queue_creation(self):
        """Test queue creation and initialization."""
        self.assertTrue(os.path.exists(self.temp_dir))
        self.assertEqual(len(self.queue.tasks), 0)
        
    def test_add_task(self):
        """Test adding a task to the queue."""
        # Add a task
        task_id = self.queue.add_task(
            task_type="sequence_analysis",
            params={"sequence": "ACGT", "analysis_type": "gc_content"},
            priority=TaskPriority.MEDIUM
        )
        
        # Verify task was added
        self.assertEqual(len(self.queue.tasks), 1)
        self.assertIn(task_id, self.queue.tasks)
        task = self.queue.tasks[task_id]
        self.assertEqual(task.status, TaskStatus.PENDING)
        self.assertEqual(task.task_type, "sequence_analysis")
        self.assertEqual(task.params["sequence"], "ACGT")
        self.assertEqual(task.priority, TaskPriority.MEDIUM)
        
    def test_get_next_task(self):
        """Test retrieving the next task based on priority."""
        # Add tasks with different priorities
        low_task = self.queue.add_task(
            task_type="test", 
            params={}, 
            priority=TaskPriority.LOW
        )
        medium_task = self.queue.add_task(
            task_type="test", 
            params={}, 
            priority=TaskPriority.MEDIUM
        )
        high_task = self.queue.add_task(
            task_type="test", 
            params={}, 
            priority=TaskPriority.HIGH
        )
        
        # The highest priority task should be returned first
        next_task = self.queue.get_next_task()
        self.assertEqual(next_task.id, high_task)
        
        # Mark it as in progress
        self.queue.update_task_status(high_task, TaskStatus.IN_PROGRESS)
        
        # The next highest priority task should be returned
        next_task = self.queue.get_next_task()
        self.assertEqual(next_task.id, medium_task)
        
        # Mark it as in progress
        self.queue.update_task_status(medium_task, TaskStatus.IN_PROGRESS)
        
        # The lowest priority task should be returned last
        next_task = self.queue.get_next_task()
        self.assertEqual(next_task.id, low_task)
        
    def test_update_task_status(self):
        """Test updating a task's status."""
        # Add a task
        task_id = self.queue.add_task(task_type="test", params={})
        
        # Update status
        self.queue.update_task_status(task_id, TaskStatus.IN_PROGRESS)
        self.assertEqual(self.queue.tasks[task_id].status, TaskStatus.IN_PROGRESS)
        
        # Update to completed with results
        results = {"result": "Test result"}
        self.queue.update_task_status(task_id, TaskStatus.COMPLETED, results=results)
        self.assertEqual(self.queue.tasks[task_id].status, TaskStatus.COMPLETED)
        self.assertEqual(self.queue.tasks[task_id].results, results)
        
    def test_persistence(self):
        """Test that tasks persist between queue instances."""
        # Add a task
        task_id = self.queue.add_task(task_type="test", params={})
        
        # Create a new queue instance with the same storage path
        new_queue = ProcessingQueue(storage_path=self.temp_dir)
        
        # Check that the task exists in the new queue
        self.assertIn(task_id, new_queue.tasks)
        self.assertEqual(new_queue.tasks[task_id].task_type, "test")
        
    def test_failed_task_handling(self):
        """Test handling of failed tasks."""
        # Add a task
        task_id = self.queue.add_task(task_type="test", params={})
        
        # Mark as failed with error message
        error = "Test error message"
        self.queue.update_task_status(task_id, TaskStatus.FAILED, error=error)
        
        # Verify status and error
        self.assertEqual(self.queue.tasks[task_id].status, TaskStatus.FAILED)
        self.assertEqual(self.queue.tasks[task_id].error, error)
        
        # Test retry
        self.queue.retry_task(task_id)
        self.assertEqual(self.queue.tasks[task_id].status, TaskStatus.PENDING)
        self.assertEqual(self.queue.tasks[task_id].retry_count, 1)
        
        # Test max retries
        for i in range(self.queue.max_retries):
            self.queue.update_task_status(task_id, TaskStatus.FAILED)
            if i < self.queue.max_retries - 1:
                self.queue.retry_task(task_id)
                
        # Try one more retry - should not change status
        self.queue.retry_task(task_id)
        self.assertEqual(self.queue.tasks[task_id].status, TaskStatus.FAILED)
        self.assertEqual(self.queue.tasks[task_id].retry_count, self.queue.max_retries)


class TestQueueManager(unittest.TestCase):
    """Test the queue manager that coordinates workers."""
    
    def setUp(self):
        """Set up test fixtures before each test method is run."""
        self.temp_dir = tempfile.mkdtemp()
        self.queue = ProcessingQueue(storage_path=self.temp_dir)
        
        # Define a simple mock processor function
        def mock_processor(task):
            if task.params.get("should_fail", False):
                raise ValueError("Simulated failure")
            return {"result": f"Processed {task.id}"}
        
        self.processors = {
            "test_task": mock_processor
        }
        
        self.manager = QueueManager(
            queue=self.queue,
            processors=self.processors,
            num_workers=2
        )
        
    def tearDown(self):
        """Tear down test fixtures after each test method is run."""
        # Stop the queue manager
        if self.manager.is_running:
            self.manager.stop()
            
        # Remove temp files
        for root, dirs, files in os.walk(self.temp_dir):
            for file in files:
                os.unlink(os.path.join(root, file))
        os.rmdir(self.temp_dir)
        
    def test_manager_startup(self):
        """Test manager startup and shutdown."""
        # Start the manager
        self.manager.start()
        self.assertTrue(self.manager.is_running)
        
        # Check that workers are created
        self.assertEqual(len(self.manager.workers), 2)
        for worker in self.manager.workers:
            self.assertTrue(worker.is_alive())
            
        # Stop the manager
        self.manager.stop()
        self.assertFalse(self.manager.is_running)
        
        # Ensure workers have stopped
        time.sleep(0.1)  # Give workers time to stop
        for worker in self.manager.workers:
            self.assertFalse(worker.is_alive())
            
    def test_task_processing(self):
        """Test end-to-end task processing."""
        # Start the manager
        self.manager.start()
        
        # Add a task
        task_id = self.queue.add_task(
            task_type="test_task",
            params={}
        )
        
        # Wait for processing to complete
        max_wait = 5  # seconds
        start_time = time.time()
        while time.time() - start_time < max_wait:
            task = self.queue.get_task(task_id)
            if task.status == TaskStatus.COMPLETED:
                break
            time.sleep(0.1)
            
        # Check results
        task = self.queue.get_task(task_id)
        self.assertEqual(task.status, TaskStatus.COMPLETED)
        self.assertEqual(task.results["result"], f"Processed {task_id}")
        
        # Test failure handling
        fail_task_id = self.queue.add_task(
            task_type="test_task",
            params={"should_fail": True}
        )
        
        # Wait for processing to complete
        start_time = time.time()
        while time.time() - start_time < max_wait:
            task = self.queue.get_task(fail_task_id)
            if task.status == TaskStatus.FAILED:
                break
            time.sleep(0.1)
            
        # Check results
        task = self.queue.get_task(fail_task_id)
        self.assertEqual(task.status, TaskStatus.FAILED)
        self.assertTrue("Simulated failure" in task.error)
        
        # Stop the manager
        self.manager.stop()


class TestProcessingWorker(unittest.TestCase):
    """Test individual processing worker."""
    
    def setUp(self):
        """Set up test fixtures before each test method is run."""
        self.queue = MagicMock()
        self.queue.get_next_task.return_value = None  # No tasks by default
        
        self.processor = MagicMock()
        self.processor.return_value = {"result": "test result"}
        
        self.processors = {"test_type": self.processor}
        
        self.event = threading.Event()
        self.worker = ProcessingWorker(
            queue=self.queue,
            processors=self.processors,
            stop_event=self.event
        )
        
    def test_worker_process_task(self):
        """Test worker processing a task."""
        # Create a mock task
        task = MagicMock()
        task.id = "test_task_id"
        task.task_type = "test_type"
        task.params = {"param1": "value1"}
        
        # Configure queue to return this task once
        self.queue.get_next_task.side_effect = [task, None]
        
        # Start the worker in a thread
        worker_thread = threading.Thread(target=self.worker.run)
        worker_thread.daemon = True
        worker_thread.start()
        
        # Give it a moment to process
        time.sleep(0.1)
        
        # Stop the worker
        self.event.set()
        worker_thread.join(timeout=1.0)
        
        # Verify the processor was called with the task
        self.processor.assert_called_once_with(task)
        
        # Verify task status was updated
        self.queue.update_task_status.assert_any_call(
            task.id, TaskStatus.IN_PROGRESS
        )
        self.queue.update_task_status.assert_any_call(
            task.id, TaskStatus.COMPLETED, results={"result": "test result"}
        )
        
    def test_worker_handle_exception(self):
        """Test worker handling a processor exception."""
        # Create a mock task
        task = MagicMock()
        task.id = "test_task_id"
        task.task_type = "test_type"
        task.params = {"param1": "value1"}
        
        # Configure processor to raise exception
        self.processor.side_effect = ValueError("Test error")
        
        # Configure queue to return this task once
        self.queue.get_next_task.side_effect = [task, None]
        
        # Start the worker in a thread
        worker_thread = threading.Thread(target=self.worker.run)
        worker_thread.daemon = True
        worker_thread.start()
        
        # Give it a moment to process
        time.sleep(0.1)
        
        # Stop the worker
        self.event.set()
        worker_thread.join(timeout=1.0)
        
        # Verify task status was updated to failed
        self.queue.update_task_status.assert_any_call(
            task.id, 
            TaskStatus.FAILED, 
            error="Test error"
        )


if __name__ == "__main__":
    unittest.main()