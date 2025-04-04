import sys
import os
import json
import inspect
from typing import List, Optional, Dict, Any
from langchain_core.tools import Tool

sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


class ToolExecutionError(Exception):
    """Custom exception for tool execution errors"""

    pass


class MyToolExecutor:
    def __init__(self, tools: List[Tool]):
        """
        Initialize the MyToolExecutor with a list of tools.
        """
        if not isinstance(tools, list):
            raise ValueError("Tools must be a list")
        if not tools:
            raise ValueError("Tools list cannot be empty")

        # Validate each tool
        for i, tool in enumerate(tools):
            if not hasattr(tool, "name") or not tool.name:
                raise ValueError(f"Tool at index {i} is missing a name attribute")
            if not hasattr(tool, "func") or not callable(tool.func):
                raise ValueError(f"Tool at index {i} is missing a callable func attribute")
            if tool.func is None:
                raise ValueError(f"Tool at index {i} has a None func attribute. You may need to add the @tool decorator to the tool function")

        self.tools = tools

    def call_tool_with_args(self, tool_name: str, tool_args: Dict[str, Any]) -> str:
        """
        Execute a tool with the given arguments.
        """
        try:
            # Validate input parameters
            if not tool_name:
                raise ValueError("Tool name cannot be empty")

            # If tool_args is a JSON string, convert to dict
            if isinstance(tool_args, str):
                try:
                    tool_args = json.loads(tool_args)
                except json.JSONDecodeError as e:
                    raise ValueError(f"Invalid JSON format in tool_args: {str(e)}")

            if not isinstance(tool_args, dict):
                raise ValueError("tool_args must be a dictionary or valid JSON string")

            # Find the tool with the name == tool_name
            target_tool = next(
                (tool for tool in self.tools if tool.name == tool_name), None
            )
            if target_tool is None:
                raise ValueError(f"Tool '{tool_name}' not found")

            # Get the signature of the target_tool.func function
            try:
                signature = inspect.signature(target_tool.func)
            except ValueError as e:
                raise ValueError(f"Failed to inspect tool function: {str(e)}")

            # Check that all mandatory arguments (without defaults) are present in tool_args
            missing_params = [
                param_name for param_name, param in signature.parameters.items()
                if param.default is inspect.Parameter.empty and param_name not in tool_args
            ]

            # If there are missing parameters, raise an exception
            if missing_params:
                missing_params_str = "\n".join(missing_params)
                raise ValueError(
                    f"The following parameters are missing for the tool '{tool_name}':\n{missing_params_str}"
                )

            # Execute the function
            result = target_tool.func(**tool_args)
            return str(result)

        except Exception as e:
            # Get the current line number where the error occurred
            exc_type, exc_obj, exc_tb = sys.exc_info()
            line_number = exc_tb.tb_lineno if exc_tb else "unknown"

            # Raise a custom exception with detailed error information
            raise ToolExecutionError(
                f"Error executing tool '{tool_name}' at line {line_number}: {str(e)}"
            ) from e
