"""
Unit tests for the result formatters module.
"""

import json
import unittest
from unittest.mock import MagicMock, patch

from dataprep.biodata.result_formatters import (
    ResultFormatter, FormatterRegistry, FormattingError
)
from dataprep.biodata.analysis_components import (
    AnalysisType, AnalysisResult
)


class TestResultFormatters(unittest.TestCase):
    """Test suite for the result formatters system."""
    
    def setUp(self):
        """Set up test fixtures before each test method is run."""
        # Create a test registry
        self.registry = FormatterRegistry()
        
        # Create a simple formatter for tables
        class TableFormatter(ResultFormatter):
            def get_name(self):
                return "table"
                
            def get_supported_formats(self):
                return ["grid", "csv", "html"]
                
            def format_result(self, result, format_type=None, options=None):
                if not format_type:
                    format_type = "grid"
                
                if format_type not in self.get_supported_formats():
                    raise FormattingError(f"Unsupported format type: {format_type}")
                
                # Extract data we expect in the result
                data = result.result_data.get("data", {})
                
                if format_type == "grid":
                    # Format as a grid table
                    headers = data.get("headers", [])
                    rows = data.get("rows", [])
                    
                    return {
                        "tableData": {
                            "headers": headers,
                            "rows": rows
                        }
                    }
                    
                elif format_type == "csv":
                    # Format as CSV
                    headers = data.get("headers", [])
                    rows = data.get("rows", [])
                    
                    lines = [",".join(headers)]
                    for row in rows:
                        lines.append(",".join(str(cell) for cell in row))
                    
                    return {
                        "csv": "\n".join(lines)
                    }
                    
                elif format_type == "html":
                    # Format as HTML table
                    headers = data.get("headers", [])
                    rows = data.get("rows", [])
                    
                    header_html = "".join(f"<th>{h}</th>" for h in headers)
                    
                    row_html = ""
                    for row in rows:
                        cells = "".join(f"<td>{cell}</td>" for cell in row)
                        row_html += f"<tr>{cells}</tr>"
                    
                    html = f"<table><thead><tr>{header_html}</tr></thead><tbody>{row_html}</tbody></table>"
                    
                    return {
                        "html": html
                    }
        
        # Register the formatter
        self.registry.register_formatter(TableFormatter())
        
        # Create a test result
        self.test_result = AnalysisResult(
            analysis_type=AnalysisType.MATRIX_STATS,
            result_data={
                "data": {
                    "headers": ["Gene", "Mean", "Std Dev"],
                    "rows": [
                        ["Gene1", 1.2, 0.5],
                        ["Gene2", 3.4, 1.2],
                        ["Gene3", 2.1, 0.8]
                    ]
                }
            },
            metadata={}
        )
        
        # Create another formatter for charts
        class ChartFormatter(ResultFormatter):
            def get_name(self):
                return "chart"
                
            def get_supported_formats(self):
                return ["line", "bar", "scatter"]
                
            def format_result(self, result, format_type=None, options=None):
                if not format_type:
                    format_type = "line"
                
                if format_type not in self.get_supported_formats():
                    raise FormattingError(f"Unsupported chart type: {format_type}")
                
                # Extract data from result
                data_points = result.result_data.get("points", [])
                
                # Basic chart config
                chart_config = {
                    "type": format_type,
                    "data": data_points,
                    "options": options or {}
                }
                
                return {
                    "chartConfig": chart_config
                }
        
        # Register the chart formatter
        self.registry.register_formatter(ChartFormatter())
    
    def test_formatter_registration(self):
        """Test that formatters can be registered and retrieved."""
        # Check the registered formatters
        formatters = self.registry.list_formatters()
        self.assertEqual(len(formatters), 2)
        self.assertTrue("table" in formatters)
        self.assertTrue("chart" in formatters)
    
    def test_table_grid_formatting(self):
        """Test formatting a result as a grid table."""
        # Format the result as grid
        formatted = self.registry.format_result(self.test_result, "table", "grid")
        
        # Verify the result
        self.assertTrue("tableData" in formatted)
        self.assertEqual(len(formatted["tableData"]["headers"]), 3)
        self.assertEqual(len(formatted["tableData"]["rows"]), 3)
        self.assertEqual(formatted["tableData"]["headers"][0], "Gene")
    
    def test_table_csv_formatting(self):
        """Test formatting a result as CSV."""
        # Format the result as CSV
        formatted = self.registry.format_result(self.test_result, "table", "csv")
        
        # Verify the result
        self.assertTrue("csv" in formatted)
        csv_lines = formatted["csv"].split("\n")
        self.assertEqual(len(csv_lines), 4)  # header + 3 data rows
        self.assertEqual(csv_lines[0], "Gene,Mean,Std Dev")
    
    def test_table_html_formatting(self):
        """Test formatting a result as HTML table."""
        # Format the result as HTML
        formatted = self.registry.format_result(self.test_result, "table", "html")
        
        # Verify the result
        self.assertTrue("html" in formatted)
        self.assertTrue("<table>" in formatted["html"])
        self.assertTrue("<th>Gene</th>" in formatted["html"])
        self.assertTrue("<td>Gene1</td>" in formatted["html"])
    
    def test_unsupported_formatter(self):
        """Test that an error is raised for unsupported formatters."""
        # Try to format with an unsupported formatter
        with self.assertRaises(ValueError):
            self.registry.format_result(self.test_result, "nonexistent", "format")
    
    def test_unsupported_format_type(self):
        """Test that an error is raised for unsupported format types."""
        # Try to format with an unsupported format type
        with self.assertRaises(FormattingError):
            self.registry.format_result(self.test_result, "table", "json")
    
    def test_chart_formatting(self):
        """Test formatting a result as a chart."""
        # Create a test result with chart data
        chart_result = AnalysisResult(
            analysis_type=AnalysisType.TIME_SERIES,
            result_data={
                "points": [
                    {"x": 1, "y": 10},
                    {"x": 2, "y": 20},
                    {"x": 3, "y": 15}
                ]
            },
            metadata={}
        )
        
        # Format as line chart
        line_chart = self.registry.format_result(chart_result, "chart", "line")
        self.assertEqual(line_chart["chartConfig"]["type"], "line")
        self.assertEqual(len(line_chart["chartConfig"]["data"]), 3)
        
        # Format as bar chart
        bar_chart = self.registry.format_result(chart_result, "chart", "bar")
        self.assertEqual(bar_chart["chartConfig"]["type"], "bar")
        
        # Format as scatter chart
        scatter_chart = self.registry.format_result(chart_result, "chart", "scatter")
        self.assertEqual(scatter_chart["chartConfig"]["type"], "scatter")
    
    def test_formatting_with_options(self):
        """Test formatting with custom options."""
        # Create options
        options = {
            "title": "Test Chart",
            "colors": ["red", "blue"],
            "showLegend": True
        }
        
        # Create a test result
        chart_result = AnalysisResult(
            analysis_type=AnalysisType.TIME_SERIES,
            result_data={
                "points": [{"x": 1, "y": 10}]
            },
            metadata={}
        )
        
        # Format with options
        formatted = self.registry.format_result(chart_result, "chart", "line", options)
        
        # Check that options were passed through
        self.assertEqual(formatted["chartConfig"]["options"], options)


if __name__ == "__main__":
    unittest.main()