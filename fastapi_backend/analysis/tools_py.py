from backend.analysis.functions import (
    plot_cell_type_dist_bar,
    train_celltypist_model,
    run_celltypist_annotation,
)
from langchain_core.tools import tool
from backend.analysis.utility import pre_and_post_process_tool
import scanpy as sc
import os

global scanpy_dict
scanpy_dict = {}

@tool
@pre_and_post_process_tool
def run_celltypist_annotation_tool(file_name: str = "Bhaduri2019v3_organoids_exprMatrix_0.05.tsv.gz.temp.h5ad"):
    """
    Plot a bar plot of cell type distribution.
    """
    adata = sc.read_h5ad(file_name)
    result = run_celltypist_annotation(adata, "Immune_All_Low.pkl")
    summary = str(result.get("summary", "No summary available"))
    return f"Cell type annotation completed. Summary: {summary}"
