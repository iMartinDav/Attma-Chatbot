import os
from typing import List, TypedDict, Optional, Union, Dict, Any, Tuple
import sys
import rpy2.robjects as ro  # type: ignore
from dotenv import load_dotenv  # type: ignore
from langchain_core.messages import (
    BaseMessage,
    AIMessage,
    HumanMessage,
    ToolMessage,
)

sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
from backend.analysis.my_tools_executor import MyToolExecutor
from backend.analysis.tools_py import run_celltypist_annotation_tool

from langchain_core.prompts import MessagesPlaceholder, ChatPromptTemplate
from langchain_core.tools import Tool
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from backend import global_variables
from langsmith import Client
from backend.global_variables import ROOT_PATH

# New imports for graph storage
import io
from datetime import datetime
from langgraph.constants import CurveStyle
from langgraph.graph.graph import MermaidDrawMethod

client = Client()

# Get the OpenAI key from the environment variable
openai_api_key = os.getenv("OPENAI_API_KEY")

# Check if the key is set
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY is not set.")
else:
    print("OPENAI_API_KEY loaded successfully.")
# Set R options to prevent deparse() from creating string vectors
ro.r("options(width=10000)")


# Define the list of tools  ## not working: plot_scatter_mitochondrial_genes,  plot_highly_variable_genes (produce plot, but give an error), plot_pca_heatmap, cluster_marker_genes

# from langchain_community.tools import TavilySearchResults
# tool_web_search = TavilySearchResults()


tools: List[Tool] = [
    # tool_web_search,
    # go_enrichment,
    # summarize_seurat, # removed because confuse llm while asking explaination of the plots
    # clear_history,
    # analyze_cluster_marker_genes_output,
    # cell_clusters,  #### problema con R
    # cell_embedding,
    # nearest_neighbor_cell_embedding,
    # log_normalize,
    # scale_data,
    # highly_variable_genes,
    # run_pca,
    # calculate_mitochondrial_genes,
    # plot_scatter_mitochondrial_genes,
    plot_violin_mitochondrial_genes,
    plot_pca,
    plot_scatter_cell_quality,
    plot_highly_variable_genes,
    plot_pca_heatmap,
    plot_pca_elbow,
    cluster_marker_genes,
    plot_embedding,
    plot_embedding_feature_expression,
    plot_violin_features,
    plot_dotplot
]  # type: ignore

#tools.extend([run_celltypist_annotation_tool])

# Define the LLM
llm = ChatOpenAI(model_name="gpt-4o", temperature=0.1)


# from langchain_ollama import ChatOllama
# llm = ChatOllama(
#     model="llama3.1",
#     temperature=0,
#     # other params...
# )

# Prompt for the chatbot
prompt = ChatPromptTemplate.from_messages(
    [
        MessagesPlaceholder(variable_name="messages"),
    ]
)

# Chain that uses the tools
chain = prompt | llm.bind_tools(tools)


# Definition of the state
class State(TypedDict):
    """Represents the state with a list of messages."""

    messages: List[BaseMessage]


def check_file_info(state: State):
    """
    Checks and processes the uploaded file information if submitted by user.
    """
    messages = state["messages"]

    if global_variables.UPLOADED_FILE == False:
        return

    if global_variables.UPLOADED_FILE == True:
        if global_variables.UPLOADED_TEXT == True:  ## uploaded PDF
            ai_message = AIMessage(
                content="This is the PDF PDF PDF PDF"
                + " this is the uploaded pdf file from the user, and it was correctly processed, no problems are detected:    "
                + global_variables.PDF_CONTENT_AS_STRING
                + "confirm the user that he uploaded a pdf file"
            )
            messages.append(ai_message)
            return {"messages": messages}
        if global_variables.UPLOADED_TEXT == False:  ## uploaded datafile

            ai_message = AIMessage(
                content="I see you uploaded a "
                + str(global_variables.JDATAFILE.getDataType())
                + " with "
                + str(global_variables.NUMCOLUMNS)
                + " columns and "
                + str(global_variables.NUMROWS)
                + " rows."
            )
            messages.append(ai_message)
            # ai_message = AIMessage(
            #     content="Here is the subset stats file: "
            #     + global_variables.SUBSET_STATS_FILE
            # )
            # messages.append(ai_message)
            global_variables.PDF_CONTENT_AS_STRING = "This is the PDF PDF PDF PDF and it was correctly processed, all is good"
            global_variables.UPLOADED_TEXT = False
            global_variables.UPLOADED_FILE = False

            return {"messages": messages}

    # metadata = get_last_uploaded_file_info() # since is not more on s3
    metadata = "Here is the metadata of the uploaded file: "  # + str(get_last_uploaded_file_info())
    ai_message = AIMessage(content=metadata)  # type: ignore
    state["messages"].append(ai_message)
    return state


# Function to reason with the LLM and print the results
def llm_reasoning(state: State):
    messages = state["messages"]

    # Execute the LLM chain with the prompt and tools ( questo per evitare errori di token, ma tuttavia inviare l'intero seurat formato json al frontend)
    # if len(messages[-1].content) > 8000:
    #     ## tagliare il messaggio
    #     messages[-1].content = messages[-1].content[:8000]

    result = chain.invoke({"messages": messages})

    # Add the result to the messages
    messages = state["messages"]
    messages.append(result)

    return {"messages": messages}


def check_tool_call(message):
    """
    Function to check if a message contains tool_calls
    """

    if isinstance(message, AIMessage):
        additional_kwargs = message.additional_kwargs
        if additional_kwargs and "tool_calls" in additional_kwargs:
            return len(additional_kwargs["tool_calls"]) > 0
    return False


def tool_execution_node(state):
    """
    Node to handle tool execution
    """
    messages = state["messages"]
    last_message = messages[-1]

    tool_calls = last_message.additional_kwargs.get("tool_calls", [])

    for tool_call in tool_calls:
        tool_call_id = tool_call.get("id", None)
        tool_name = tool_call.get("function", {}).get("name", None)
        tool_args = tool_call.get("function", {}).get("arguments", {})

        tool_executor = MyToolExecutor(tools)
        content = tool_executor.call_tool_with_args(tool_name, tool_args)
        
        tool_message = None
        if isinstance(content, str):
            tool_message = ToolMessage(
                content=content, 
                name=tool_name, 
                tool_call_id=tool_call_id
            )
        elif isinstance(content, tuple):
            tool_message = ToolMessage(
                content="Called creation plot",
                name=tool_name,
                tool_call_id=tool_call_id,
            )

        messages.append(tool_message)

    return {"messages": messages}


def finish(state):
    """
    Appends an AIMessage indicating the current loop count to the state's messages.
    """
    ai_message = AIMessage(content="end of loop number: " + str(len(state["messages"])))  # type: ignore
    state["messages"].append(ai_message)
    return state


def router(state):
    """
    Routing function to decide whether to call the tool
    """
    # messages = state["messages"]
    # last_message = messages[-1]

    # if check_tool_call(last_message):
    #     return "call_tool"
    # return "end"
    messages = state["messages"]
    last_message = messages[-1]
    if last_message.tool_calls:
        return "call_tool"
    return "end"


def create_graph(save_to_file: bool = True, output_file_path: Optional[str] = None) -> Union[None, bytes]:
    """
    Create the state graph with the ToolNode and either save it to a file or return it as bytes
    
    Args:
        save_to_file: If True, save to file path; if False, return bytes
        output_file_path: Path to save the file (if save_to_file is True)
        
    Returns:
        bytes if save_to_file is False, otherwise None
    """
    graph_builder = StateGraph(State)
    graph_builder.add_node("process_file_if_submitted_by_user", check_file_info)
    graph_builder.add_node("chatbot", llm_reasoning)

    graph_builder.add_node("execute_tool", tool_execution_node)

    graph_builder.set_entry_point("process_file_if_submitted_by_user")
    graph_builder.add_edge("process_file_if_submitted_by_user", "chatbot")

    graph_builder.add_conditional_edges(
        "chatbot",
        router,
        {"call_tool": "execute_tool", "end": END},
    )

    graph_builder.add_edge("execute_tool", "chatbot")

    graph = graph_builder.compile()
    
    # Get the graph visualization
    if save_to_file:
        # Default path if none provided
        if output_file_path is None:
            output_file_path = "../../analysis/graph.png"
            
        # Save to file as before
        graph.get_graph().draw_mermaid_png(
            curve_style=CurveStyle.LINEAR,
            wrap_label_n_words=9,
            output_file_path=output_file_path,
            draw_method=MermaidDrawMethod.PYPPETEER,
            background_color="white",
            padding=10,
        )
        return None
    else:
        # Return as bytes
        buffer = io.BytesIO()
        graph.get_graph().draw_mermaid_png(
            curve_style=CurveStyle.LINEAR,
            wrap_label_n_words=9,
            output_file=buffer,  # Use the buffer instead of a file path
            draw_method=MermaidDrawMethod.PYPPETEER,
            background_color="white",
            padding=10,
        )
        buffer.seek(0)
        return buffer.getvalue()


async def create_and_store_graph(
    title: str,
    user_id: str,
    workflow_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Tuple[bool, str, Optional[str]]:
    """
    Create the graph visualization and store it in Vercel Blob Storage
    
    Args:
        title: Title for the graph visualization
        user_id: ID of the user who created the graph
        workflow_id: Optional ID of the associated workflow
        metadata: Optional additional metadata
        
    Returns:
        Tuple of (success, message, blob_url if successful)
    """
    from backend.analysis.utility import store_graph_visualization
    
    # Create graph in memory
    graph_bytes = create_graph(save_to_file=False)
    
    if not graph_bytes:
        return (False, "Failed to generate graph visualization", None)
    
    # Store the graph using the utility function
    success, message, result_data = await store_graph_visualization(
        graph_data=graph_bytes,
        title=title,
        user_id=user_id,
        workflow_id=workflow_id,
        metadata=metadata
    )
    
    if success and result_data:
        blob_url = result_data.get("blob_url")
        return (True, "Graph visualization stored successfully", blob_url)
    
    return (success, message, None)


if __name__ == "__main__":
    # Initialize the environment and create the global seurat_object

    from backend import global_variables

    global_variables.DEBUG = False

    initialize_environment()

    # Create the graph and save to file (original behavior)
    graph = create_graph(save_to_file=True)

    initial_state = {"messages": [HumanMessage(content="fammi un hvg plot")]}

    # initial_state_two_messages = {
    #     "messages": [
    #         HumanMessage(
    #             content="fammi un violin plot",
    #             additional_kwargs={},
    #             response_metadata={},
    #         ),
    #         AIMessage(
    #             content="",
    #             additional_kwargs={
    #                 "tool_calls": [
    #                     {
    #                         "id": "call_DWhLVufQhLAdujXXiNoKejjH",
    #                         "function": {
    #                             "arguments": "{}",
    #                             "name": "plot_violin_mitochondrial_genes",
    #                         },
    #                         "type": "function",
    #                     }
    #                 ],
    #                 "refusal": None,
    #             },
    #             response_metadata={
    #                 "token_usage": {
    #                     "completion_tokens": 18,
    #                     "prompt_tokens": 756,
    #                     "total_tokens": 774,
    #                     "completion_tokens_details": {
    #                         "audio_tokens": 0,
    #                         "reasoning_tokens": 0,
    #                         "accepted_prediction_tokens": 0,
    #                         "rejected_prediction_tokens": 0,
    #                     },
    #                     "prompt_tokens_details": {
    #                         "audio_tokens": 0,
    #                         "cached_tokens": 0,
    #                     },
    #                 },
    #                 "model_name": "gpt-4o-mini-2024-07-18",
    #                 "system_fingerprint": "fp_0ba0d124f1",
    #                 "finish_reason": "tool_calls",
    #                 "logprobs": None,
    #             },
    #             id="run-cc81d4f9-70fa-4891-8979-01884c8df7cf-0",
    #             tool_calls=[
    #                 {
    #                     "name": "plot_violin_mitochondrial_genes",
    #                     "args": {},
    #                     "id": "call_DWhLVufQhLAdujXXiNoKejjH",
    #                     "type": "tool_call",
    #                 }
    #             ],
    #             usage_metadata={
    #                 "input_tokens": 756,
    #                 "output_tokens": 18,
    #                 "total_tokens": 774,
    #                 "input_token_details": {"audio": 0, "cache_read": 0},
    #                 "output_token_details": {"audio": 0, "reasoning": 0},
    #             },
    #         ),
    #         ToolMessage(
    #             content="Violin plot generated successfully",
    #             name="plot_violin_mitochondrial_genes",
    #             tool_call_id="call_DWhLVufQhLAdujXXiNoKejjH",
    #         ),
    #         AIMessage(
    #             content="Il violin plot è stato generato con successo! Se hai bisogno di ulteriori analisi o visualizzazioni, fammi sapere!",
    #             additional_kwargs={"refusal": None},
    #             response_metadata={
    #                 "token_usage": {
    #                     "completion_tokens": 28,
    #                     "prompt_tokens": 795,
    #                     "total_tokens": 823,
    #                     "completion_tokens_details": {
    #                         "audio_tokens": 0,
    #                         "reasoning_tokens": 0,
    #                         "accepted_prediction_tokens": 0,
    #                         "rejected_prediction_tokens": 0,
    #                     },
    #                     "prompt_tokens_details": {
    #                         "audio_tokens": 0,
    #                         "cached_tokens": 0,
    #                     },
    #                 },
    #                 "model_name": "gpt-4o-mini-2024-07-18",
    #                 "system_fingerprint": "fp_0ba0d124f1",
    #                 "finish_reason": "stop",
    #                 "logprobs": None,
    #             },
    #             id="run-c70a1748-22bb-4a33-a225-01f9078cf638-0",
    #             usage_metadata={
    #                 "input_tokens": 795,
    #                 "output_tokens": 28,
    #                 "total_tokens": 823,
    #                 "input_token_details": {"audio": 0, "cache_read": 0},
    #                 "output_token_details": {"audio": 0, "reasoning": 0},
    #             },
    #         ),
    #         HumanMessage(
    #             content="fammi un altro violin plot",
    #             additional_kwargs={},
    #             response_metadata={},
    #         ),
    #     ]
    # }
    import pprint

    # Creare un'istanza di PrettyPrinter con indentazione personalizzata
    pp = pprint.PrettyPrinter(indent=4, width=120)

    for s in graph.stream(initial_state):
        my_dict = list(s.values())[0]

        pp.pprint(my_dict)

"""
Graph visualization module for bioflow analysis.

This module provides functionality for generating various types of
visualizations for biological data, such as UMAP, t-SNE, PCA,
and heatmaps.
"""

import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from typing import Dict, Any, Optional, Union, List
import io
import base64
import json
import logging
import asyncio
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
import umap
from .utility import get_sample_data

# Configure logging
logger = logging.getLogger(__name__)

# Define supported visualization types
SUPPORTED_VIS_TYPES = ["umap", "tsne", "pca", "heatmap", "violin", "scatter"]

async def generate_visualization(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate a visualization based on the provided request.
    
    Args:
        request: A dictionary containing the visualization request details.
            Required keys:
                - visualization_type: Type of visualization to generate (e.g., "umap", "tsne")
                - data_description: Description of the data to visualize
            Optional keys:
                - parameters: Visualization-specific parameters
                - title: Title for the visualization
                
    Returns:
        Dict[str, Any]: A dictionary containing:
            - image: Base64-encoded PNG image
            - metadata: Additional metadata about the visualization
    """
    # Extract request parameters
    vis_type = request.get("visualization_type", "").lower()
    parameters = request.get("parameters", {})
    data_description = request.get("data_description", "")
    title = request.get("title", f"{vis_type.upper()} Visualization")
    
    # Check if visualization type is supported
    if vis_type not in SUPPORTED_VIS_TYPES:
        raise ValueError(f"Unsupported visualization type: {vis_type}. "
                         f"Supported types: {', '.join(SUPPORTED_VIS_TYPES)}")
    
    # Get data based on description (in a real application, this would query a database)
    # Here we're using sample data for demonstration
    data = await get_sample_data(data_description)
    
    # Generate the visualization
    if vis_type == "umap":
        return await generate_umap_visualization(data, parameters, title)
    elif vis_type == "tsne":
        return await generate_tsne_visualization(data, parameters, title)
    elif vis_type == "pca":
        return await generate_pca_visualization(data, parameters, title)
    elif vis_type == "heatmap":
        return await generate_heatmap_visualization(data, parameters, title)
    elif vis_type == "violin":
        return await generate_violin_visualization(data, parameters, title)
    elif vis_type == "scatter":
        return await generate_scatter_visualization(data, parameters, title)
    else:
        raise ValueError(f"Visualization type {vis_type} is supported but not implemented")

async def generate_umap_visualization(
    data: pd.DataFrame,
    parameters: Dict[str, Any],
    title: str
) -> Dict[str, Any]:
    """Generate a UMAP visualization."""
    # Extract parameters with defaults
    n_neighbors = parameters.get("n_neighbors", 15)
    min_dist = parameters.get("min_dist", 0.1)
    n_components = parameters.get("n_components", 2)
    metric = parameters.get("metric", "euclidean")
    
    # Create a figure
    plt.figure(figsize=(10, 8))
    
    # Run UMAP
    reducer = umap.UMAP(
        n_neighbors=n_neighbors,
        min_dist=min_dist,
        n_components=n_components,
        metric=metric,
        random_state=42
    )
    
    # Extract features (all numeric columns)
    features = data.select_dtypes(include=[np.number])
    
    # Check if we have enough data
    if len(features) < 5:
        raise ValueError("Not enough data for UMAP visualization (need at least 5 samples)")
    
    # Transform the data
    embedding = reducer.fit_transform(features)
    
    # Create a scatter plot
    if n_components == 2:
        plt.scatter(embedding[:, 0], embedding[:, 1], s=5, alpha=0.8)
    elif n_components == 3:
        ax = plt.figure().add_subplot(111, projection='3d')
        ax.scatter(embedding[:, 0], embedding[:, 1], embedding[:, 2], s=5, alpha=0.8)
    
    # Add labels and title
    plt.title(title)
    plt.xlabel(f"UMAP Dimension 1")
    plt.ylabel(f"UMAP Dimension 2")
    
    # Save the plot to a BytesIO object
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
    plt.close()
    
    # Get the image as base64
    buf.seek(0)
    image_base64 = base64.b64encode(buf.read()).decode('utf-8')
    
    # Return the result
    return {
        "image": image_base64,
        "metadata": {
            "n_neighbors": n_neighbors,
            "min_dist": min_dist,
            "n_components": n_components,
            "metric": metric,
            "data_stats": {
                "n_samples": len(data),
                "n_features": features.shape[1],
            }
        }
    }

async def generate_tsne_visualization(
    data: pd.DataFrame,
    parameters: Dict[str, Any],
    title: str
) -> Dict[str, Any]:
    """Generate a t-SNE visualization."""
    # Extract parameters with defaults
    perplexity = parameters.get("perplexity", 30.0)
    n_components = parameters.get("n_components", 2)
    learning_rate = parameters.get("learning_rate", 200.0)
    
    # Create a figure
    plt.figure(figsize=(10, 8))
    
    # Extract features (all numeric columns)
    features = data.select_dtypes(include=[np.number])
    
    # Check if we have enough data
    if len(features) < 5:
        raise ValueError("Not enough data for t-SNE visualization (need at least 5 samples)")
    
    # Run t-SNE
    tsne = TSNE(
        n_components=n_components,
        perplexity=min(perplexity, len(features) - 1),
        learning_rate=learning_rate,
        random_state=42
    )
    
    # Transform the data
    embedding = tsne.fit_transform(features)
    
    # Create a scatter plot
    plt.scatter(embedding[:, 0], embedding[:, 1], s=5, alpha=0.8)
    
    # Add labels and title
    plt.title(title)
    plt.xlabel(f"t-SNE Dimension 1")
    plt.ylabel(f"t-SNE Dimension 2")
    
    # Save the plot to a BytesIO object
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
    plt.close()
    
    # Get the image as base64
    buf.seek(0)
    image_base64 = base64.b64encode(buf.read()).decode('utf-8')
    
    # Return the result
    return {
        "image": image_base64,
        "metadata": {
            "perplexity": perplexity,
            "n_components": n_components,
            "learning_rate": learning_rate,
            "data_stats": {
                "n_samples": len(data),
                "n_features": features.shape[1],
            }
        }
    }

async def generate_pca_visualization(
    data: pd.DataFrame,
    parameters: Dict[str, Any],
    title: str
) -> Dict[str, Any]:
    """Generate a PCA visualization."""
    # Extract parameters with defaults
    n_components = parameters.get("n_components", 2)
    
    # Create a figure
    plt.figure(figsize=(10, 8))
    
    # Extract features (all numeric columns)
    features = data.select_dtypes(include=[np.number])
    
    # Check if we have enough data
    if len(features) < 3:
        raise ValueError("Not enough data for PCA visualization (need at least 3 samples)")
    
    # Run PCA
    pca = PCA(n_components=min(n_components, features.shape[1]))
    
    # Transform the data
    embedding = pca.fit_transform(features)
    
    # Calculate explained variance
    explained_variance = pca.explained_variance_ratio_
    explained_variance_cumsum = np.cumsum(explained_variance)
    
    # Create a scatter plot
    if n_components == 2:
        plt.scatter(embedding[:, 0], embedding[:, 1], s=5, alpha=0.8)
        plt.xlabel(f"PC1 ({explained_variance[0]:.2%} variance)")
        plt.ylabel(f"PC2 ({explained_variance[1]:.2%} variance)")
    elif n_components == 3:
        ax = plt.figure().add_subplot(111, projection='3d')
        ax.scatter(embedding[:, 0], embedding[:, 1], embedding[:, 2], s=5, alpha=0.8)
        ax.set_xlabel(f"PC1 ({explained_variance[0]:.2%})")
        ax.set_ylabel(f"PC2 ({explained_variance[1]:.2%})")
        ax.set_zlabel(f"PC3 ({explained_variance[2]:.2%})")
    
    # Add title
    plt.title(title)
    
    # Save the plot to a BytesIO object
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
    plt.close()
    
    # Get the image as base64
    buf.seek(0)
    image_base64 = base64.b64encode(buf.read()).decode('utf-8')
    
    # Return the result
    return {
        "image": image_base64,
        "metadata": {
            "n_components": n_components,
            "explained_variance": explained_variance.tolist(),
            "explained_variance_cumsum": explained_variance_cumsum.tolist(),
            "data_stats": {
                "n_samples": len(data),
                "n_features": features.shape[1],
            }
        }
    }

async def generate_heatmap_visualization(
    data: pd.DataFrame,
    parameters: Dict[str, Any],
    title: str
) -> Dict[str, Any]:
    """Generate a heatmap visualization."""
    # Extract parameters with defaults
    cmap = parameters.get("cmap", "viridis")
    cluster_rows = parameters.get("cluster_rows", True)
    cluster_cols = parameters.get("cluster_cols", True)
    max_features = parameters.get("max_features", 100)
    max_samples = parameters.get("max_samples", 100)
    
    # Create a figure
    plt.figure(figsize=(12, 10))
    
    # Extract features (all numeric columns)
    features = data.select_dtypes(include=[np.number])
    
    # Check if we have enough data
    if len(features) < 2 or features.shape[1] < 2:
        raise ValueError("Not enough data for heatmap visualization (need at least 2x2)")
    
    # Subsample if necessary
    if features.shape[0] > max_samples:
        features = features.sample(max_samples, random_state=42)
    
    if features.shape[1] > max_features:
        features = features.sample(max_features, axis=1, random_state=42)
    
    # Create the heatmap
    sns.heatmap(
        features,
        cmap=cmap,
        xticklabels=True if features.shape[1] <= 30 else False,
        yticklabels=True if features.shape[0] <= 30 else False,
        cbar=True
    )
    
    # Add title
    plt.title(title)
    
    # Save the plot to a BytesIO object
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
    plt.close()
    
    # Get the image as base64
    buf.seek(0)
    image_base64 = base64.b64encode(buf.read()).decode('utf-8')
    
    # Return the result
    return {
        "image": image_base64,
        "metadata": {
            "cmap": cmap,
            "data_stats": {
                "n_samples": features.shape[0],
                "n_features": features.shape[1],
                "min_value": float(features.min().min()),
                "max_value": float(features.max().max()),
                "mean_value": float(features.mean().mean()),
            }
        }
    }

async def generate_violin_visualization(
    data: pd.DataFrame,
    parameters: Dict[str, Any],
    title: str
) -> Dict[str, Any]:
    """Generate a violin plot visualization."""
    # Extract parameters with defaults
    feature = parameters.get("feature")
    group_by = parameters.get("group_by")
    split = parameters.get("split", False)
    
    # Check if required parameters are provided
    if not feature:
        # Pick the first numeric column if not specified
        numeric_cols = data.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) == 0:
            raise ValueError("No numeric columns found for violin plot")
        feature = numeric_cols[0]
    
    # Create a figure
    plt.figure(figsize=(12, 8))
    
    # Create the violin plot
    if group_by and group_by in data.columns:
        sns.violinplot(
            x=group_by,
            y=feature,
            data=data,
            inner="box",
            split=split
        )
    else:
        sns.violinplot(
            y=feature,
            data=data,
            inner="box"
        )
    
    # Add title
    plt.title(title)
    
    # Save the plot to a BytesIO object
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
    plt.close()
    
    # Get the image as base64
    buf.seek(0)
    image_base64 = base64.b64encode(buf.read()).decode('utf-8')
    
    # Return the result
    return {
        "image": image_base64,
        "metadata": {
            "feature": feature,
            "group_by": group_by,
            "data_stats": {
                "n_samples": len(data),
                "min_value": float(data[feature].min()),
                "max_value": float(data[feature].max()),
                "mean_value": float(data[feature].mean()),
                "median_value": float(data[feature].median()),
            }
        }
    }

async def generate_scatter_visualization(
    data: pd.DataFrame,
    parameters: Dict[str, Any],
    title: str
) -> Dict[str, Any]:
    """Generate a scatter plot visualization."""
    # Extract parameters with defaults
    x = parameters.get("x")
    y = parameters.get("y")
    hue = parameters.get("hue")
    
    # Check if required parameters are provided
    if not x or not y:
        # Pick the first two numeric columns if not specified
        numeric_cols = data.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) < 2:
            raise ValueError("Need at least two numeric columns for scatter plot")
        x = numeric_cols[0]
        y = numeric_cols[1]
    
    # Create a figure
    plt.figure(figsize=(10, 8))
    
    # Create the scatter plot
    if hue and hue in data.columns:
        sns.scatterplot(
            x=x,
            y=y,
            hue=hue,
            data=data
        )
    else:
        sns.scatterplot(
            x=x,
            y=y,
            data=data
        )
    
    # Add title
    plt.title(title)
    
    # Save the plot to a BytesIO object
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
    plt.close()
    
    # Get the image as base64
    buf.seek(0)
    image_base64 = base64.b64encode(buf.read()).decode('utf-8')
    
    # Return the result
    return {
        "image": image_base64,
        "metadata": {
            "x": x,
            "y": y,
            "hue": hue,
            "data_stats": {
                "n_samples": len(data),
                f"{x}_min": float(data[x].min()),
                f"{x}_max": float(data[x].max()),
                f"{y}_min": float(data[y].min()),
                f"{y}_max": float(data[y].max()),
                "correlation": float(data[x].corr(data[y])),
            }
        }
    }