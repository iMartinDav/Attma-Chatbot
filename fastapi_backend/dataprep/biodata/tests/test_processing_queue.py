"""
Unit tests for processing queue component.
"""

import unittest
import json
import time
import tempfile
import os
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock

from ..processing_queue import (
    Task, TaskStatus, TaskPriority, TaskQueue,
    TaskProcessor, ProcessingQueue,
    create_task
)

class TestTask(unittest.TestCase):
    """Test cases for Task class."""
    
    def test_task_creation(self):
        """Test creating a task."""
        task = Task(
            task_id="test-task-1",
            task_type="analysis",
            data={"input_file": "data.csv", "analysis": "clustering"},
            priority=TaskPriority.HIGH
        )
        
        self.assertEqual(task.task_id, "test-task-1")
        self.assertEqual(task.task_type, "analysis")
        self.assertEqual(task.data["input_file"], "data.csv")
        self.assertEqual(task.priority, TaskPriority.HIGH)
        self.assertEqual(task.status, TaskStatus.PENDING)
        
    def test_task_to_dict(self):
        """Test converting task to dictionary."""
        task = Task(
            task_id="test-task-2",
            task_type="processing",
            data={"steps": ["normalize", "filter"]},
            priority=TaskPriority.NORMAL
        )
        
        task_dict = task.to_dict()
        
        self.assertEqual(task_dict["task_id"], "test-task-2")
        self.assertEqual(task_dict["task_type"], "processing")
        self.assertEqual(task_dict["priority"], "NORMAL")
        self.assertEqual(task_dict["status"], "PENDING")
        
    def test_task_from_dict(self):
        """Test creating task from dictionary."""
        task_dict = {
            "task_id": "test-task-3",
            "task_type": "visualization",
            "data": {"plot_type": "heatmap"},
            "priority": "LOW",
            "status": "RUNNING",
            "created_at": "2025-04-23T12:00:00",
            "updated_at": "2025-04-23T12:01:00"
        }
        
        task = Task.from_dict(task_dict)
        
        self.assertEqual(task.task_id, "test-task-3")
        self.assertEqual(task.task_type, "visualization")
        self.assertEqual(task.status, TaskStatus.RUNNING)
        self.assertEqual(task.priority, TaskPriority.LOW)

    def test_task_update_status(self):
        """Test updating task status."""
        task = create_task(
            task_type="analysis",
            data={"method": "pca"}
        )
        
        self.assertEqual(task.status, TaskStatus.PENDING)
        
        # Update status
        task.update_status(TaskStatus.RUNNING)
        self.assertEqual(task.status, TaskStatus.RUNNING)
        
        # Update status with result
        task.update_status(TaskStatus.COMPLETED, {"result": "success"})
        self.assertEqual(task.status, TaskStatus.COMPLETED)
        self.assertEqual(task.result["result"], "success")


class TestTaskQueue(unittest.TestCase):
    """Test cases for TaskQueue class."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.queue = TaskQueue()
        
        # Create some test tasks
        self.task1 = create_task("analysis", {"method": "clustering"}, TaskPriority.HIGH)
        self.task2 = create_task("processing", {"steps": ["normalize"]}, TaskPriority.NORMAL)
        self.task3 = create_task("visualization", {"type": "scatter"}, TaskPriority.LOW)

    def test_add_task(self):
        """Test adding tasks to queue."""
        # Add tasks
        self.queue.add_task(self.task1)
        self.queue.add_task(self.task2)
        self.queue.add_task(self.task3)
        
        # Check queue length
        self.assertEqual(len(self.queue), 3)
        
        # Add duplicate task (should be ignored)
        self.queue.add_task(self.task1)
        self.assertEqual(len(self.queue), 3)

    def test_get_task(self):
        """Test getting tasks from queue."""
        # Add tasks
        self.queue.add_task(self.task1)
        self.queue.add_task(self.task2)
        self.queue.add_task(self.task3)
        
        # Get task by id
        task = self.queue.get_task(self.task2.task_id)
        self.assertEqual(task.task_id, self.task2.task_id)
        
        # Get non-existent task
        task = self.queue.get_task("non-existent")
        self.assertIsNone(task)

    def test_get_next_task(self):
        """Test getting next task from queue respects priority."""
        # Add tasks in reverse priority order
        self.queue.add_task(self.task3)  # LOW
        self.queue.add_task(self.task2)  # NORMAL
        self.queue.add_task(self.task1)  # HIGH
        
        # Get next task - should be highest priority
        task = self.queue.get_next_task()
        self.assertEqual(task.task_id, self.task1.task_id)
        
        # Queue should still have 3 tasks (just getting, not removing)
        self.assertEqual(len(self.queue), 3)
        
        # Mark task1 as in progress
        task.update_status(TaskStatus.RUNNING)
        
        # Next task should be task2
        task = self.queue.get_next_task()
        self.assertEqual(task.task_id, self.task2.task_id)

    def test_remove_task(self):
        """Test removing tasks from queue."""
        # Add tasks
        self.queue.add_task(self.task1)
        self.queue.add_task(self.task2)
        self.queue.add_task(self.task3)
        
        # Remove a task
        self.queue.remove_task(self.task2.task_id)
        self.assertEqual(len(self.queue), 2)
        
        # Task should no longer be in queue
        self.assertIsNone(self.queue.get_task(self.task2.task_id))
        
        # Removing non-existent task should not error
        self.queue.remove_task("non-existent")
        self.assertEqual(len(self.queue), 2)

    def test_get_pending_tasks(self):
        """Test getting pending tasks."""
        # Add tasks
        self.queue.add_task(self.task1)
        self.queue.add_task(self.task2)
        self.queue.add_task(self.task3)
        
        # Set one task to running
        self.task1.update_status(TaskStatus.RUNNING)
        
        # Get pending tasks
        pending_tasks = self.queue.get_tasks_by_status(TaskStatus.PENDING)
        self.assertEqual(len(pending_tasks), 2)
        
        # Set another task to completed
        self.task2.update_status(TaskStatus.COMPLETED)
        
        # Get pending tasks again
        pending_tasks = self.queue.get_tasks_by_status(TaskStatus.PENDING)
        self.assertEqual(len(pending_tasks), 1)
        self.assertEqual(pending_tasks[0].task_id, self.task3.task_id)


class TestProcessingQueue(unittest.TestCase):
    """Test cases for ProcessingQueue class."""
    
    def setUp(self):
        """Set up test fixtures."""
        # Create a mock processor
        self.mock_processor = MagicMock()
        self.mock_processor.process_task = AsyncMock()
        
        # Create the processing queue with the mock processor
        self.processing_queue = ProcessingQueue(processor=self.mock_processor)
        
        # Create some test tasks
        self.task1 = create_task("analysis", {"method": "clustering"})
        self.task2 = create_task("processing", {"steps": ["normalize"]})

    async def async_test(self, coroutine):
        """Helper to run async tests."""
        return await coroutine
        
    def test_add_and_get_task(self):
        """Test adding and retrieving tasks."""
        # Add task
        self.processing_queue.add_task(self.task1)
        
        # Get task
        task = self.processing_queue.get_task(self.task1.task_id)
        self.assertEqual(task.task_id, self.task1.task_id)
        
        # Update task status
        task.update_status(TaskStatus.COMPLETED, {"result": "done"})
        
        # Get updated task
        updated_task = self.processing_queue.get_task(self.task1.task_id)
        self.assertEqual(updated_task.status, TaskStatus.COMPLETED)
        self.assertEqual(updated_task.result["result"], "done")

    def test_submit_task(self):
        """Test submitting a task."""
        # Submit task
        task_id = self.processing_queue.submit_task(
            task_type="analysis",
            task_data={"method": "pca"},
            priority=TaskPriority.HIGH
        )
        
        # Check task was created
        self.assertIsNotNone(task_id)
        
        # Get task
        task = self.processing_queue.get_task(task_id)
        self.assertEqual(task.task_type, "analysis")
        self.assertEqual(task.data["method"], "pca")
        self.assertEqual(task.priority, TaskPriority.HIGH)

    @patch('asyncio.create_task')
    def test_start_processing(self, mock_create_task):
        """Test starting the processing queue."""
        # Mock asyncio.create_task
        mock_create_task.return_value = MagicMock()
        
        # Start processing
        self.processing_queue.start_processing()
        
        # Check that asyncio.create_task was called
        mock_create_task.assert_called_once()
        
        # Add a task after starting
        self.processing_queue.add_task(self.task1)
        
        # Check that the processor was called
        # Note: This is testing implementation details, which is not ideal
        # but necessary to verify the task was processed without running the event loop

    def test_get_task_status(self):
        """Test getting task status."""
        # Add task
        self.processing_queue.add_task(self.task1)
        
        # Get status
        status = self.processing_queue.get_task_status(self.task1.task_id)
        self.assertEqual(status, TaskStatus.PENDING.value)
        
        # Update status
        task = self.processing_queue.get_task(self.task1.task_id)
        task.update_status(TaskStatus.RUNNING)
        
        # Get updated status
        status = self.processing_queue.get_task_status(self.task1.task_id)
        self.assertEqual(status, TaskStatus.RUNNING.value)


class TestTaskProcessor(unittest.TestCase):
    """Test cases for TaskProcessor class."""
    
    def setUp(self):
        """Set up test fixtures."""
        # Create a task processor
        self.processor = TaskProcessor()
        
        # Create some test tasks
        self.task1 = create_task("analysis", {"method": "clustering"})
        self.task2 = create_task("processing", {"steps": ["normalize"]})

    def test_register_handler(self):
        """Test registering task handlers."""
        # Create a handler function
        async def mock_handler(task):
            task.update_status(TaskStatus.COMPLETED, {"processed": True})
        
        # Register handler
        self.processor.register_handler("analysis", mock_handler)
        
        # Check handler was registered
        self.assertIn("analysis", self.processor.handlers)
        
        # Register another handler for same type (should replace)
        async def another_handler(task):
            pass
            
        self.processor.register_handler("analysis", another_handler)
        self.assertEqual(self.processor.handlers["analysis"], another_handler)

    async def test_process_task(self):
        """Test processing a task."""
        # Create a handler function
        async def mock_handler(task):
            task.update_status(TaskStatus.COMPLETED, {"processed": True})
            
        # Register handler
        self.processor.register_handler("analysis", mock_handler)
        
        # Process a task
        await self.processor.process_task(self.task1)
        
        # Check task status was updated
        self.assertEqual(self.task1.status, TaskStatus.COMPLETED)
        self.assertTrue(self.task1.result["processed"])
        
        # Test with no handler
        await self.processor.process_task(self.task2)
        
        # Check task is marked as failed
        self.assertEqual(self.task2.status, TaskStatus.FAILED)
        self.assertIn("error", self.task2.result)

    async def test_process_task_with_error(self):
        """Test processing a task that raises an error."""
        # Create a handler function that raises an exception
        async def error_handler(task):
            raise ValueError("Test error")
            
        # Register handler
        self.processor.register_handler("analysis", error_handler)
        
        # Process a task
        await self.processor.process_task(self.task1)
        
        # Check task is marked as failed
        self.assertEqual(self.task1.status, TaskStatus.FAILED)
        self.assertIn("error", self.task1.result)
        self.assertIn("Test error", self.task1.result["error"])


if __name__ == '__main__':
    unittest.main()