"""
Analysis Result Formatters.

This module provides formatters for converting analysis results into
various formats suitable for frontend visualization and artifact creation.
"""

import os
import json
import logging
import base64
from io import BytesIO
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List, Union
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats

from .analysis_components import AnalysisResult, AnalysisType

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class FormattingError(Exception):
    """Exception raised for errors during result formatting."""
    pass


class ResultFormatter(ABC):
    """
    Abstract base class for result formatters.
    
    This class defines the interface for all result formatters.
    Subclasses must implement the format_result method.
    """
    
    @abstractmethod
    def format_result(
        self, 
        result: AnalysisResult, 
        format_type: str, 
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Format an analysis result for visualization.
        
        Args:
            result: The analysis result to format
            format_type: The desired output format
            options: Additional formatting options
            
        Returns:
            Formatted result data ready for visualization
            
        Raises:
            FormattingError: If formatting fails
        """
        pass


class TableFormatter(ResultFormatter):
    """
    Format results as tabular data.
    
    This formatter converts analysis results into table formats
    suitable for display in grid components.
    """
    
    def format_result(
        self, 
        result: AnalysisResult, 
        format_type: str = "grid", 
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Format an analysis result as tabular data.
        
        Args:
            result: The analysis result to format
            format_type: The specific table format to use (grid, csv, excel)
            options: Additional formatting options
            
        Returns:
            Formatted table data
            
        Raises:
            FormattingError: If formatting fails
        """
        if not options:
            options = {}
            
        try:
            # Extract the result data
            data = result.result_data
            
            if format_type == "grid":
                return self._format_as_grid(result, data, options)
            elif format_type == "csv":
                return self._format_as_csv(result, data, options)
            elif format_type == "excel":
                return self._format_as_excel(result, data, options)
            else:
                raise FormattingError(f"Unsupported table format: {format_type}")
                
        except Exception as e:
            logger.error(f"Error formatting result as table: {str(e)}")
            if isinstance(e, FormattingError):
                raise
            raise FormattingError(f"Failed to format result as table: {str(e)}")
    
    def _format_as_grid(
        self, 
        result: AnalysisResult,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Format result as a grid data structure for UI components."""
        table_data = {"columns": [], "rows": []}
        metadata = {"total_rows": 0, "total_columns": 0}
        
        # Handle different analysis types differently
        if result.analysis_type == AnalysisType.MATRIX_STATS:
            # For matrix stats, convert the stats to a table
            table_data["columns"] = [
                {"field": "statistic", "headerName": "Statistic", "width": 200},
                {"field": "value", "headerName": "Value", "width": 150}
            ]
            
            rows = []
            row_index = 0
            
            # Add basic stats
            for key, value in data.items():
                # Skip complex data structures or convert them to string
                if key in ["column_names_sample", "row_names_sample"]:
                    if isinstance(value, list) and len(value) > 0:
                        value = ", ".join(str(v) for v in value[:5]) + "..."
                    continue
                
                rows.append({
                    "id": row_index,
                    "statistic": key,
                    "value": str(value)
                })
                row_index += 1
            
            table_data["rows"] = rows
            metadata["total_rows"] = len(rows)
            metadata["total_columns"] = 2
            
        elif result.analysis_type == AnalysisType.CLUSTERING:
            # For clustering, create a table of cluster assignments
            if "clusters" in data and "cell_names" in data:
                table_data["columns"] = [
                    {"field": "cell", "headerName": "Cell", "width": 150},
                    {"field": "cluster", "headerName": "Cluster", "width": 100}
                ]
                
                # Create rows (limit to 1000)
                clusters = data["clusters"]
                cell_names = data["cell_names"]
                max_rows = min(len(clusters), len(cell_names), options.get("max_rows", 1000))
                
                rows = []
                for i in range(max_rows):
                    rows.append({
                        "id": i,
                        "cell": cell_names[i],
                        "cluster": clusters[i]
                    })
                
                table_data["rows"] = rows
                metadata["total_rows"] = len(clusters)
                metadata["total_columns"] = 2
                metadata["displayed_rows"] = len(rows)
                
        else:
            # Generic approach for other analysis types
            # Convert the result data into a flat table structure
            flat_data = self._flatten_data(data)
            
            # Create columns
            table_data["columns"] = [
                {"field": "key", "headerName": "Property", "width": 200},
                {"field": "value", "headerName": "Value", "width": 300}
            ]
            
            # Create rows
            rows = []
            for i, (key, value) in enumerate(flat_data.items()):
                rows.append({
                    "id": i,
                    "key": key,
                    "value": str(value) if not isinstance(value, (list, dict)) else json.dumps(value)
                })
            
            table_data["rows"] = rows
            metadata["total_rows"] = len(rows)
            metadata["total_columns"] = 2
        
        return {
            "tableData": table_data,
            "metadata": metadata,
            "formatType": "grid"
        }
    
    def _format_as_csv(
        self, 
        result: AnalysisResult,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Format result as CSV."""
        try:
            # Convert data to DataFrame
            df = self._convert_to_dataframe(result, data, options)
            
            # Convert DataFrame to CSV
            csv_buffer = BytesIO()
            df.to_csv(csv_buffer, index=False, encoding='utf-8')
            csv_data = csv_buffer.getvalue().decode('utf-8')
            
            return {
                "data": csv_data,
                "metadata": {
                    "rows": len(df),
                    "columns": len(df.columns),
                    "format": "csv"
                },
                "formatType": "csv"
            }
        except Exception as e:
            logger.error(f"Error formatting as CSV: {str(e)}")
            raise FormattingError(f"Failed to format as CSV: {str(e)}")
    
    def _format_as_excel(
        self, 
        result: AnalysisResult,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Format result as Excel."""
        try:
            # Convert data to DataFrame
            df = self._convert_to_dataframe(result, data, options)
            
            # Convert DataFrame to Excel
            excel_buffer = BytesIO()
            df.to_excel(excel_buffer, index=False, engine='xlsxwriter')
            excel_data = base64.b64encode(excel_buffer.getvalue()).decode('utf-8')
            
            return {
                "data": excel_data,
                "metadata": {
                    "rows": len(df),
                    "columns": len(df.columns),
                    "format": "excel"
                },
                "formatType": "excel"
            }
        except Exception as e:
            logger.error(f"Error formatting as Excel: {str(e)}")
            raise FormattingError(f"Failed to format as Excel: {str(e)}")
    
    def _convert_to_dataframe(
        self, 
        result: AnalysisResult,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> pd.DataFrame:
        """Convert analysis result to a Pandas DataFrame."""
        if result.analysis_type == AnalysisType.MATRIX_STATS:
            # Flatten data for stats
            flat_data = self._flatten_data(data)
            df = pd.DataFrame(list(flat_data.items()), columns=["Statistic", "Value"])
            
        elif result.analysis_type == AnalysisType.CLUSTERING:
            # Create clusters DataFrame
            if "clusters" in data and "cell_names" in data:
                df = pd.DataFrame({
                    "Cell": data["cell_names"],
                    "Cluster": data["clusters"]
                })
            else:
                df = pd.DataFrame(self._flatten_data(data).items(), columns=["Property", "Value"])
                
        elif result.analysis_type == AnalysisType.DIMENSION_REDUCTION:
            # Create coordinates DataFrame
            if "coordinates" in data and "cell_names" in data:
                coords = data["coordinates"]
                n_components = len(coords[0]) if coords and len(coords) > 0 else 0
                
                df_dict = {"Cell": data["cell_names"]}
                for i in range(n_components):
                    df_dict[f"Component_{i+1}"] = [coords[j][i] for j in range(len(coords))]
                
                df = pd.DataFrame(df_dict)
            else:
                df = pd.DataFrame(self._flatten_data(data).items(), columns=["Property", "Value"])
        
        else:
            # Generic approach
            df = pd.DataFrame(self._flatten_data(data).items(), columns=["Property", "Value"])
            
        return df
    
    def _flatten_data(self, data: Dict[str, Any], prefix: str = "") -> Dict[str, Any]:
        """Flatten nested dictionaries with key path prefixes."""
        result = {}
        
        for key, value in data.items():
            new_key = f"{prefix}.{key}" if prefix else key
            
            if isinstance(value, dict):
                # Recursively flatten dictionaries
                result.update(self._flatten_data(value, new_key))
            elif isinstance(value, list) and all(isinstance(item, dict) for item in value):
                # Handle lists of dictionaries
                for i, item in enumerate(value):
                    result.update(self._flatten_data(item, f"{new_key}[{i}]"))
            else:
                # Add leaf values
                result[new_key] = value
                
        return result


class GraphFormatter(ResultFormatter):
    """
    Format results as graph/chart data.
    
    This formatter converts analysis results into various chart formats
    for visualization in graph components.
    """
    
    def format_result(
        self, 
        result: AnalysisResult, 
        format_type: str = "scatter", 
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Format an analysis result as graph data.
        
        Args:
            result: The analysis result to format
            format_type: The specific graph format (scatter, bar, heatmap)
            options: Additional formatting options
            
        Returns:
            Formatted graph data
            
        Raises:
            FormattingError: If formatting fails
        """
        if not options:
            options = {}
            
        try:
            # Extract the result data
            data = result.result_data
            
            if format_type == "scatter":
                return self._format_as_scatter(result, data, options)
            elif format_type == "bar":
                return self._format_as_bar(result, data, options)
            elif format_type == "heatmap":
                return self._format_as_heatmap(result, data, options)
            elif format_type == "plotly":
                return self._format_as_plotly(result, data, options)
            elif format_type == "image":
                return self._format_as_image(result, data, options)
            else:
                raise FormattingError(f"Unsupported graph format: {format_type}")
                
        except Exception as e:
            logger.error(f"Error formatting result as graph: {str(e)}")
            if isinstance(e, FormattingError):
                raise
            raise FormattingError(f"Failed to format result as graph: {str(e)}")
    
    def _format_as_scatter(
        self, 
        result: AnalysisResult,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Format result as a scatter plot."""
        graph_data = {"series": [], "options": {}}
        metadata = {"type": "scatter"}
        
        if result.analysis_type == AnalysisType.DIMENSION_REDUCTION:
            # For dimension reduction results, create a scatter plot
            if "coordinates" in data and len(data["coordinates"]) > 0:
                coordinates = data["coordinates"]
                
                # Get the first two dimensions
                x_coords = [coord[0] for coord in coordinates]
                y_coords = [coord[1] for coord in coordinates]
                
                # Get cell names or generate placeholders
                cell_names = data.get("cell_names", [f"Cell_{i}" for i in range(len(coordinates))])
                
                # Create series data
                series_data = []
                for i in range(len(coordinates)):
                    series_data.append({
                        "x": x_coords[i],
                        "y": y_coords[i],
                        "name": cell_names[i]
                    })
                
                # Add clustering data if available in options
                color_by = options.get("color_by")
                if color_by and isinstance(color_by, list) and len(color_by) == len(coordinates):
                    # Group by color
                    clusters = {}
                    for i, cluster in enumerate(color_by):
                        cluster_name = f"Cluster {cluster}"
                        if cluster_name not in clusters:
                            clusters[cluster_name] = []
                        
                        clusters[cluster_name].append({
                            "x": x_coords[i],
                            "y": y_coords[i],
                            "name": cell_names[i]
                        })
                    
                    # Create series for each cluster
                    for cluster_name, points in clusters.items():
                        graph_data["series"].append({
                            "name": cluster_name,
                            "data": points
                        })
                else:
                    # Single series for all points
                    graph_data["series"].append({
                        "name": "Cells",
                        "data": series_data
                    })
                
                # Set chart options
                method = data.get("method", "unknown").upper()
                component1 = options.get("component1_label", "Component 1")
                component2 = options.get("component2_label", "Component 2")
                
                graph_data["options"] = {
                    "chart": {
                        "type": "scatter",
                        "zoom": {
                            "enabled": True
                        }
                    },
                    "title": {
                        "text": f"{method} Dimension Reduction"
                    },
                    "xaxis": {
                        "title": {
                            "text": component1
                        },
                        "tickAmount": 10
                    },
                    "yaxis": {
                        "title": {
                            "text": component2
                        },
                        "tickAmount": 10
                    },
                    "tooltip": {
                        "enabled": True,
                        "shared": False
                    },
                    "legend": {
                        "position": "right"
                    }
                }
                
                # Add metadata
                metadata["points"] = len(coordinates)
                metadata["dimensions"] = len(coordinates[0]) if coordinates else 0
                metadata["method"] = data.get("method", "unknown")
                
        elif result.analysis_type == AnalysisType.CLUSTERING:
            # For clustering results, create a distribution plot
            if "clusters" in data:
                clusters = data["clusters"]
                
                # Count frequency of each cluster
                cluster_counts = {}
                for cluster in clusters:
                    cluster_name = f"Cluster {cluster}"
                    cluster_counts[cluster_name] = cluster_counts.get(cluster_name, 0) + 1
                
                # Sort by cluster number
                sorted_clusters = sorted(cluster_counts.items(), key=lambda x: int(x[0].split()[1]))
                
                # Create bar chart data
                graph_data["series"] = [{
                    "name": "Cell Count",
                    "data": [count for _, count in sorted_clusters]
                }]
                
                graph_data["options"] = {
                    "chart": {
                        "type": "bar"
                    },
                    "plotOptions": {
                        "bar": {
                            "horizontal": False
                        }
                    },
                    "title": {
                        "text": "Cluster Cell Distribution"
                    },
                    "xaxis": {
                        "categories": [name for name, _ in sorted_clusters],
                        "title": {
                            "text": "Cluster"
                        }
                    },
                    "yaxis": {
                        "title": {
                            "text": "Number of Cells"
                        }
                    }
                }
                
                # Update metadata
                metadata["type"] = "bar"
                metadata["clusters"] = len(cluster_counts)
                metadata["total_cells"] = len(clusters)
            
        else:
            # Generic approach for other result types
            # Create dummy scatter data if we can't derive it from the result
            graph_data["series"] = [{
                "name": "Data",
                "data": [
                    {"x": 1, "y": 10},
                    {"x": 2, "y": 7},
                    {"x": 3, "y": 15},
                    {"x": 4, "y": 12},
                    {"x": 5, "y": 18}
                ]
            }]
            
            graph_data["options"] = {
                "chart": {
                    "type": "scatter",
                    "zoom": {
                        "enabled": True
                    }
                },
                "title": {
                    "text": "Result Visualization"
                },
                "xaxis": {
                    "title": {
                        "text": "X Axis"
                    }
                },
                "yaxis": {
                    "title": {
                        "text": "Y Axis"
                    }
                }
            }
        
        return {
            "graphData": graph_data,
            "metadata": metadata,
            "formatType": "scatter"
        }
    
    def _format_as_bar(
        self, 
        result: AnalysisResult,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Format result as a bar chart."""
        # For simplicity, just a placeholder implementation
        # In a real implementation, we would create proper bar chart data
        # based on the analysis result
        
        graph_data = {
            "series": [{
                "name": "Value",
                "data": [10, 41, 35, 51, 49, 62]
            }],
            "options": {
                "chart": {
                    "type": "bar"
                },
                "plotOptions": {
                    "bar": {
                        "horizontal": False,
                    }
                },
                "title": {
                    "text": "Result Bar Chart"
                },
                "xaxis": {
                    "categories": ["Category A", "Category B", "Category C", 
                                  "Category D", "Category E", "Category F"]
                }
            }
        }
        
        return {
            "graphData": graph_data,
            "metadata": {
                "type": "bar",
                "categories": 6
            },
            "formatType": "bar"
        }
    
    def _format_as_heatmap(
        self, 
        result: AnalysisResult,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Format result as a heatmap."""
        # For simplicity, just a placeholder implementation
        # In a real implementation, we would create proper heatmap data
        # based on the analysis result
        
        # Generate a simple heatmap
        series = []
        for i in range(5):
            for j in range(5):
                value = np.random.randint(1, 100)
                series.append({
                    "x": f"Column {j+1}",
                    "y": f"Row {i+1}",
                    "value": value
                })
        
        graph_data = {
            "series": [{
                "name": "Value",
                "data": series
            }],
            "options": {
                "chart": {
                    "type": "heatmap",
                },
                "title": {
                    "text": "Result Heatmap"
                },
                "plotOptions": {
                    "heatmap": {
                        "shadeIntensity": 0.5,
                        "colorScale": {
                            "ranges": [{
                                "from": 0,
                                "to": 20,
                                "name": "Low",
                                "color": "#00A100"
                            }, {
                                "from": 21,
                                "to": 50,
                                "name": "Medium",
                                "color": "#128FD9"
                            }, {
                                "from": 51,
                                "to": 100,
                                "name": "High",
                                "color": "#FFB200"
                            }]
                        }
                    }
                }
            }
        }
        
        return {
            "graphData": graph_data,
            "metadata": {
                "type": "heatmap",
                "rows": 5,
                "columns": 5
            },
            "formatType": "heatmap"
        }
    
    def _format_as_plotly(
        self, 
        result: AnalysisResult,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Format result as Plotly JSON."""
        # This is a placeholder for generating Plotly-compatible JSON
        # In a real implementation, we would use Plotly to create
        # a visualization and export it as JSON
        
        # Create a basic Plotly-compatible structure
        plotly_data = [
            {
                "type": "scatter",
                "mode": "markers",
                "x": [1, 2, 3, 4, 5],
                "y": [10, 7, 15, 12, 18],
                "marker": {
                    "size": 10
                },
                "name": "Series A"
            }
        ]
        
        plotly_layout = {
            "title": "Plotly Visualization",
            "xaxis": {
                "title": "X Axis"
            },
            "yaxis": {
                "title": "Y Axis"
            }
        }
        
        return {
            "data": plotly_data,
            "layout": plotly_layout,
            "config": {
                "responsive": True
            },
            "metadata": {
                "format": "plotly",
                "library": "plotly.js"
            },
            "formatType": "plotly"
        }
    
    def _format_as_image(
        self, 
        result: AnalysisResult,
        data: Dict[str, Any],
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Format result as an image using Matplotlib."""
        try:
            # Set default figure size and style
            figsize = options.get("figsize", (10, 6))
            style = options.get("style", "default")
            dpi = options.get("dpi", 100)
            
            # Set matplotlib style
            with plt.style.context(style):
                # Create figure
                fig, ax = plt.subplots(figsize=figsize, dpi=dpi)
                
                # Different visualizations based on analysis type
                if result.analysis_type == AnalysisType.DIMENSION_REDUCTION:
                    self._plot_dimension_reduction(ax, data, options)
                    title = f"{data.get('method', 'Unknown').upper()} Projection"
                
                elif result.analysis_type == AnalysisType.CLUSTERING:
                    self._plot_clustering(ax, data, options)
                    title = f"Clustering Results ({data.get('method', 'Unknown')})"
                
                else:
                    # Generic plot
                    ax.text(0.5, 0.5, "No visualization available for this result type",
                            ha="center", va="center", fontsize=12)
                    title = "Result Visualization"
                
                # Set title and labels
                custom_title = options.get("title")
                ax.set_title(custom_title or title)
                
                if "xlabel" in options:
                    ax.set_xlabel(options["xlabel"])
                    
                if "ylabel" in options:
                    ax.set_ylabel(options["ylabel"])
                
                # Add legend if needed
                if options.get("show_legend", True) and len(ax.collections) > 0:
                    ax.legend()
                
                # Save figure to buffer
                buf = BytesIO()
                fig.tight_layout()
                fig.savefig(buf, format="png")
                plt.close(fig)
                
                # Convert to base64
                image_data = base64.b64encode(buf.getvalue()).decode("utf-8")
                
                return {
                    "imageData": f"data:image/png;base64,{image_data}",
                    "metadata": {
                        "format": "image/png",
                        "width": figsize[0] * dpi,
                        "height": figsize[1] * dpi
                    },
                    "formatType": "image"
                }
                
        except Exception as e:
            logger.error(f"Error generating image: {str(e)}")
            raise FormattingError(f"Failed to generate image: {str(e)}")
    
    def _plot_dimension_reduction(self, ax, data, options):
        """Create a dimension reduction plot on the given axis."""
        if "coordinates" in data and len(data["coordinates"]) > 0:
            coordinates = data["coordinates"]
            
            # Extract the first two dimensions
            x_coords = [coord[0] for coord in coordinates]
            y_coords = [coord[1] for coord in coordinates]
            
            # Check if we have color information
            color_data = options.get("color_by")
            if color_data and len(color_data) == len(coordinates):
                # Color by cluster or other categorical data
                scatter = ax.scatter(x_coords, y_coords, c=color_data, 
                                    cmap=options.get("colormap", "viridis"),
                                    alpha=options.get("alpha", 0.7),
                                    s=options.get("point_size", 30))
                
                # Add colorbar if requested
                if options.get("show_colorbar", True):
                    plt.colorbar(scatter, ax=ax)
            else:
                # Single color scatter
                ax.scatter(x_coords, y_coords, 
                          color=options.get("color", "blue"),
                          alpha=options.get("alpha", 0.7),
                          s=options.get("point_size", 30))
            
            # Set labels
            method = data.get("method", "unknown").upper()
            ax.set_xlabel(options.get("xlabel", f"{method} 1"))
            ax.set_ylabel(options.get("ylabel", f"{method} 2"))
            
            # Equal aspect ratio often looks better for dimension reduction
            if options.get("equal_aspect", True):
                ax.set_aspect('equal')
    
    def _plot_clustering(self, ax, data, options):
        """Create a clustering visualization on the given axis."""
        if "clusters" in data:
            clusters = data["clusters"]
            
            # Count frequency of each cluster
            unique_clusters = sorted(set(clusters))
            cluster_counts = []
            
            for cluster in unique_clusters:
                count = sum(1 for c in clusters if c == cluster)
                cluster_counts.append(count)
            
            # Create bar chart
            bars = ax.bar([str(c) for c in unique_clusters], cluster_counts,
                         color=options.get("color", "skyblue"))
            
            # Add count labels on top of bars
            if options.get("show_counts", True):
                for bar, count in zip(bars, cluster_counts):
                    height = bar.get_height()
                    ax.text(bar.get_x() + bar.get_width()/2., height + 0.1,
                           str(count), ha='center', va='bottom')
            
            # Set labels
            ax.set_xlabel(options.get("xlabel", "Cluster"))
            ax.set_ylabel(options.get("ylabel", "Number of Cells"))


class FormatterRegistry:
    """
    Registry of result formatters.
    
    This class manages the available formatters and provides methods
    to find and use the appropriate formatter for a given result.
    """
    
    def __init__(self):
        """Initialize the registry with default formatters."""
        self._formatters = {}
        
        # Register default formatters
        self.register_formatter("table", TableFormatter())
        self.register_formatter("graph", GraphFormatter())
    
    def register_formatter(self, format_name: str, formatter: ResultFormatter) -> None:
        """
        Register a formatter for a specific format.
        
        Args:
            format_name: Name of the format
            formatter: Formatter instance
        """
        self._formatters[format_name] = formatter
        logger.info(f"Registered formatter for format: {format_name}")
    
    def get_formatter(self, format_name: str) -> ResultFormatter:
        """
        Get a formatter for the specified format.
        
        Args:
            format_name: Name of the format
            
        Returns:
            Formatter instance
            
        Raises:
            ValueError: If no formatter is registered for the format
        """
        if format_name not in self._formatters:
            raise ValueError(f"No formatter registered for format: {format_name}")
        
        return self._formatters[format_name]
    
    def format_result(
        self, 
        result: AnalysisResult, 
        format_name: str,
        format_type: str = None,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Format an analysis result using the appropriate formatter.
        
        Args:
            result: Analysis result to format
            format_name: Name of the format (table, graph, etc.)
            format_type: Specific type within the format (grid, scatter, etc.)
            options: Additional formatting options
            
        Returns:
            Formatted result
            
        Raises:
            ValueError: If no formatter is registered for the format
            FormattingError: If formatting fails
        """
        formatter = self.get_formatter(format_name)
        return formatter.format_result(result, format_type or "default", options)
    
    def list_formatters(self) -> List[str]:
        """
        List all registered formatters.
        
        Returns:
            List of formatter names
        """
        return list(self._formatters.keys())


# Global registry instance
registry = FormatterRegistry()


def get_formatter_registry() -> FormatterRegistry:
    """
    Get the global formatter registry.
    
    Returns:
        The global formatter registry instance
    """
    return registry


# Example usage
if __name__ == "__main__":
    from .analysis_components import AnalysisRegistry, AnalysisType, get_analysis_registry
    
    # Create a simple analysis result
    analysis_registry = get_analysis_registry()
    formatter_registry = get_formatter_registry()
    
    # Create a test input file
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
        f.write(b"gene,cell1,cell2,cell3\n")
        f.write(b"gene1,1.0,2.0,3.0\n")
        f.write(b"gene2,4.0,5.0,6.0\n")
        test_file = f.name
    
    try:
        # Run a matrix stats analysis
        print("Running matrix stats analysis...")
        result = analysis_registry.analyze(
            AnalysisType.MATRIX_STATS,
            {"input": test_file}
        )
        
        # Format as table
        print("\nFormatting as table...")
        table_data = formatter_registry.format_result(result, "table", "grid")
        print(f"Table data has {len(table_data['tableData']['rows'])} rows")
        
        # Format as CSV
        print("\nFormatting as CSV...")
        csv_data = formatter_registry.format_result(result, "table", "csv")
        print(f"CSV data size: {len(csv_data['data'])} bytes")
        
        # Run a dimension reduction analysis
        print("\nRunning dimension reduction analysis...")
        result = analysis_registry.analyze(
            AnalysisType.DIMENSION_REDUCTION,
            {"input": test_file, "method": "pca"}
        )
        
        # Format as graph
        print("\nFormatting as scatter plot...")
        scatter_data = formatter_registry.format_result(result, "graph", "scatter")
        print(f"Scatter data has {scatter_data['metadata']['points']} points")
        
        # Format as image
        print("\nFormatting as image...")
        image_data = formatter_registry.format_result(result, "graph", "image")
        print(f"Image data size: {len(image_data['imageData'])} bytes")
        
    finally:
        # Clean up
        if os.path.exists(test_file):
            os.unlink(test_file)