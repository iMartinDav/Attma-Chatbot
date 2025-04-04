from typing import List, Dict, Optional, Union, Any
from pydantic import BaseModel, Field, FilePath, validator
from enum import Enum
import uuid

from .base_models import BaseResponse


class FileFormat(str, Enum):
    """Supported file formats for single-cell data."""
    MTX = "mtx"
    H5AD = "h5ad"
    HDF5 = "h5"
    CSV = "csv"
    TSV = "tsv"
    ARCHIVE = "zip"


class NormalizationMethod(str, Enum):
    """Supported normalization methods."""
    LOG = "log"
    SCT = "sct"
    NONE = "none"


class DimensionalityReductionMethod(str, Enum):
    """Supported dimensionality reduction methods."""
    PCA = "pca"
    UMAP = "umap"
    TSNE = "tsne"


class ClusteringMethod(str, Enum):
    """Supported clustering methods."""
    LEIDEN = "leiden"
    LOUVAIN = "louvain"
    KMEANS = "kmeans"


class MarkerGenesMethod(str, Enum):
    WILCOXON = "wilcoxon"
    T_TEST = "t-test"
    LOGREG = "logreg"


class PlotType(str, Enum):
    EMBEDDING_UMAP = "umap"
    EMBEDDING_TSNE = "tsne"
    EMBEDDING_PCA = "pca"
    EMBEDDING_UMAP_CLUSTERS = "umap_clusters"
    EMBEDDING_TSNE_CLUSTERS = "tsne_clusters"
    EMBEDDING_PCA_CLUSTERS = "pca_clusters"
    VIOLIN_MT = "violin_mt"
    HIGHLY_VARIABLE_GENES = "highly_variable_genes"
    PCA_VARIANCE = "pca_variance"
    DOTPLOT = "dotplot"


class SingleCellBaseRequest(BaseModel):
    """Base request model for single-cell analysis."""
    adata_id: str = Field(..., description="The ID of the AnnData object to use.")


class SingleCellBaseResponse(BaseModel):
    """Base response model for single-cell analysis."""
    adata_id: str = Field(..., description="The ID of the AnnData object.")
    summary: Dict[str, Any] = Field(default_factory=dict, description="Summary information.")


class SingleCellDataLoadRequest(BaseModel):
    """Request model for loading single-cell data."""
    file_path: str = Field(..., description="Path to the data file or directory.")
    project_name: str = Field(..., description="Name of the project.")
    metadata_path: Optional[str] = Field(None, description="Path to the metadata file.")
    coordinates_path: Optional[str] = Field(None, description="Path to the coordinates file.")


class SingleCellDataLoadResponse(SingleCellBaseResponse):
    """Response model for loading single-cell data."""
    project_name: str = Field(..., description="Name of the project.")
    n_obs: int = Field(..., description="Number of observations (cells).")
    n_vars: int = Field(..., description="Number of variables (genes).")


class QualityControlRequest(SingleCellBaseRequest):
    """Request model for quality control."""
    min_genes: Optional[int] = Field(200, description="Minimum number of genes per cell.")
    max_genes: Optional[int] = Field(None, description="Maximum number of genes per cell.")
    min_counts: Optional[int] = Field(None, description="Minimum number of counts per cell.")
    max_counts: Optional[int] = Field(None, description="Maximum number of counts per cell.")
    max_mt_pct: Optional[float] = Field(20.0, description="Maximum percentage of mitochondrial genes.")
    min_cells: Optional[int] = Field(3, description="Minimum number of cells for a gene.")
    max_cells: Optional[int] = Field(None, description="Maximum number of cells for a gene.")
    subset_size: Optional[int] = Field(None, description="Number of cells to randomly subset to.")


class QualityControlResponse(SingleCellBaseResponse):
    """Response model for quality control."""
    n_cells_original: int = Field(..., description="Original number of cells.")
    n_genes_original: int = Field(..., description="Original number of genes.")
    n_cells_after_qc: int = Field(..., description="Number of cells after QC.")
    n_genes_after_qc: int = Field(..., description="Number of genes after QC.")
    mean_genes_per_cell: float = Field(..., description="Mean number of genes per cell.")
    mean_counts_per_cell: float = Field(..., description="Mean number of counts per cell.")
    mt_pct_mean: float = Field(..., description="Mean percentage of mitochondrial genes.")


class NormalizationRequest(SingleCellBaseRequest):
    """Request model for normalization."""
    method: NormalizationMethod = Field(NormalizationMethod.LOG, description="Normalization method.")
    scale_factor: int = Field(10000, description="Scale factor for normalization.")
    highly_variable: bool = Field(True, description="Find highly variable genes.")
    n_top_genes: int = Field(2000, description="Number of top highly variable genes.")


class NormalizationResponse(SingleCellBaseResponse):
    """Response model for normalization."""
    method: str = Field(..., description="Normalization method used.")
    scale_factor: int = Field(..., description="Scale factor used.")
    n_highly_variable: Optional[int] = Field(None, description="Number of highly variable genes.")


class DimensionalityReductionRequest(SingleCellBaseRequest):
    """Request model for dimensionality reduction."""
    method: DimensionalityReductionMethod = Field(..., description="Dimensionality reduction method.")
    n_components: int = Field(50, description="Number of components.")
    use_highly_variable: bool = Field(True, description="Use highly variable genes.")


class DimensionalityReductionResponse(SingleCellBaseResponse):
    """Response model for dimensionality reduction."""
    method: str = Field(..., description="Dimensionality reduction method used.")
    n_components: int = Field(..., description="Number of components used.")
    variance_explained: Optional[float] = Field(None, description="Variance explained (for PCA).")


class ClusteringRequest(SingleCellBaseRequest):
    """Request model for clustering."""
    method: ClusteringMethod = Field(ClusteringMethod.LEIDEN, description="Clustering method.")
    n_neighbors: int = Field(15, description="Number of neighbors for neighborhood graph.")
    resolution: float = Field(0.5, description="Resolution for community detection.")
    n_clusters: Optional[int] = Field(None, description="Number of clusters (for k-means).")
    embedding: str = Field("X_pca", description="Embedding to use for clustering.")


class ClusteringResponse(SingleCellBaseResponse):
    """Response model for clustering."""
    method: str = Field(..., description="Clustering method used.")
    n_clusters: int = Field(..., description="Number of clusters found.")
    cluster_sizes: Dict[str, int] = Field(..., description="Size of each cluster.")


class PlotRequest(SingleCellBaseRequest):
    """Request model for plotting."""
    plot_type: str = Field(..., description="Type of plot to generate.")
    width: int = Field(800, description="Width of the plot in pixels.")
    height: int = Field(600, description="Height of the plot in pixels.")
    color_by: Optional[str] = Field(None, description="Variable to color by.")
    save_path: Optional[str] = Field(None, description="Path to save the plot.")


class PlotResponse(BaseModel):
    """Response model for plotting."""
    plot_id: str = Field(..., description="ID of the generated plot.")
    plot_type: str = Field(..., description="Type of plot generated.")
    plot_url: str = Field(..., description="URL to access the plot.")
    description: str = Field(..., description="Description of the plot.")


class MarkerGenesRequest(SingleCellBaseRequest):
    """Request model for marker genes."""
    cluster_key: str = Field("leiden", description="Key for the cluster labels.")
    method: MarkerGenesMethod = Field(MarkerGenesMethod.WILCOXON, description="Method for marker gene identification.")
    min_pct: float = Field(0.1, description="Minimum percentage of cells expressing the gene.")
    min_logfc: float = Field(0.25, description="Minimum log fold change.")
    n_genes: int = Field(100, description="Number of genes to return per cluster.")


class MarkerGenesResponse(BaseModel):
    """Response model for marker genes."""
    adata_id: str = Field(..., description="The ID of the AnnData object.")
    markers: Dict[str, List[Dict[str, Any]]] = Field(..., description="Marker genes per cluster.")
    cluster_key: str = Field(..., description="Key for the cluster labels.")
    method: str = Field(..., description="Method used for marker gene identification.") 