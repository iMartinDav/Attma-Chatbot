# ==========================================================
# Variables and Function Definitions
# ==========================================================
import celltypist
from celltypist import models, annotate
import matplotlib.pyplot as plt
import plotly.graph_objs as go
import scanpy as sc
import numpy as np
import os

def get_call_signature(function_name, args, verbose=True):
    """Generate a call signature for function caching"""
    arg_str = ', '.join([f"{k}={v}" for k, v in args.items()])
    call = f"{function_name}({arg_str})"
    if verbose:
        print(call)
    return call


def add_result(adata, call, summary, plot=None):
    """Add result to AnnData object's uns attribute"""
    if "summaries" not in adata.uns:
        adata.uns["summaries"] = {}
    adata.uns["summaries"][call] = summary
    if plot is not None:
        if "plots" not in adata.uns:
            adata.uns["plots"] = {}
        adata.uns["plots"][call] = plot
    return adata


def get_result(adata, call, plot=None):
    """Get result from AnnData object's uns attribute"""
    if plot is None:
        value = {"adata": adata, "summary": adata.uns["summaries"][call]}
    else:
        value = {"adata": adata, "plot": adata.uns["plots"][call],
                 "summary": adata.uns["summaries"][call]}
    return value


def log_normalize(adata):
    """
    Normalizes gene expression values in an AnnData object using total count
    normalization followed by log transformation. This function ensures that
    normalization is applied only once per AnnData object by checking the
    `called_functions` log in `adata.uns`.

    Parameters:
    -----------
    adata : anndata.AnnData
        The AnnData object containing raw gene expression data.

    Returns:
    --------
    anndata.AnnData
        The AnnData object with normalized and log-transf. expression values.

    Notes:
    ------
    - Normalization is performed by scaling each cell's total counts to 10,000
      (`sc.pp.normalize_total`).
    - A `log1p` transformation (`log(1 + x)`) is applied to normalize variance.
    - The function keeps track of applied transformations in
      `adata.uns['called_functions']` to prevent redundant normalization.

    Example:
    --------
    >>> adata = log_normalize(adata)
    """
    filtered_vars = {k: v for k, v in locals().items() if k != 'adata'}
    call = get_call_signature(function_name='log_normalize', args=filtered_vars)

    # check if the adata has already been normalized
    if 'called_functions' not in adata.uns:
        adata.uns['called_functions'] = []
    elif call in adata.uns['called_functions']:
        print("Adata object already normalized")
        return adata

    sc.pp.normalize_total(adata, target_sum=10000)
    sc.pp.log1p(adata)

    adata.uns['called_functions'].append(call)
    return adata


def plot_cell_type_dist_bar(adata, group_by='majority_voting',
                            plot_y_relative=True, plot_plotly=True):
    """
    Creates a bar plot to visualize cell type distributions in an adata object.

    Parameters:
    -----------
    adata : AnnData
        An annotated data matrix containing single-cell RNA-seq data.
    group_by : str, optional
        The column in `adata.obs` used to group and count cell types. Default
        is 'majority_voting', the ID that the celltypist annotation uses.
    plot_y_relative : bool, optional
        If True, plots the cell type distribution as percentages. If False,
        plots absolute counts. Default is True.
    plot_plotly : bool, optional
        If True, generates the bar plot using Plotly for interactive
        visualization. If False, uses Matplotlib for static visualization.
        Default is True.

    Description:
    ------------
    This function calculates and visualizes the distribution of cell types in
    the dataset, grouped by the specified `group_by` column. Depending on the
    `plot_y_relative` parameter, the y-axis shows either relative percentages
    or absolute cell counts. The resulting plot can be static (Matplotlib) or
    interactive (Plotly), based on the `plot_plotly` parameter.

    To plot celltype distributions an annotated dataset is needed. If that is
    not the case, the function run_celltypist_annotation could be used to
    annotate the dataset.

    Results are cached in `adata.uns['called_functions']` to avoid redundant
    computations. The function also saves the generated plots to disk in a
    temporary directory.

    Returns:
    --------
    Result
        Returns a cached or newly generated result containing the plot and
        updates `adata.uns`.

    Side Effects:
    -------------
    - Saves plots to disk in 'tmp/celltypist_annotation.html' (Plotly) or
      'tmp/celltypist_annotation.png' (Matplotlib).
    - Updates `adata.uns['called_functions']` to store function call details.
    """
    filtered_vars = {k: v for k, v in locals().items() if k != 'adata'}
    call = get_call_signature(function_name='plot_cell_type_dist_bar',
                              args=filtered_vars)

    if 'called_functions' not in adata.uns:
        adata.uns['called_functions'] = []
    elif call in adata.uns['called_functions']:
        return get_result(adata, call, plot=True)

    cell_type_counts = adata.obs[group_by].value_counts()
    cell_type_percentages = (cell_type_counts / cell_type_counts.sum()) * 100

    if plot_y_relative is True:
        x = cell_type_percentages.index
        y = cell_type_percentages.values
        ylabel = 'Percentage of Cells (%)'
    else:
        x = cell_type_counts.index
        y = cell_type_counts.values
        ylabel = 'Cell Count'

    if plot_plotly is True:
        plotly_fig = go.Figure(data=[go.Bar(x=x, y=y)])
        plotly_fig.update_layout(
            xaxis=dict(
                mirror=False,
                ticks='outside',
                tickvals=list(range(len(x.categories))),
                ticktext=x.categories[::-1]
            ),
            yaxis=dict(
                title=ylabel,
                showgrid=True,
                gridcolor='lightgray',
                mirror=False,
                ticks='outside'
            ),
            plot_bgcolor='white'
        )
        
        # Get the directory of the current file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        tmp_dir = os.path.join(os.path.dirname(os.path.dirname(current_dir)), 'web/tmp')
        
        # Create tmp directory if it doesn't exist
        os.makedirs(tmp_dir, exist_ok=True)
        
        # Save the plot
        file_path = os.path.join(tmp_dir, "celltypist_annotation.html")
        plotly_fig.write_html(file_path)
        plot = plotly_fig
    else:
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.bar(x, y)
        ax.set_ylabel(ylabel)
        plt.tight_layout()
        plt.show()
        
        # Save the plot
        file_path = os.path.join(tmp_dir, "celltypist_annotation.png")
        plt.savefig(file_path)
        plot = fig

    adata.uns['called_functions'].append(call)
    adata = add_result(adata, call=call, plot=plot, 
                      summary={"cell_types": len(x), "total_cells": len(adata)})
    return get_result(adata, call, plot=True)


def train_celltypist_model(adata, cell_type_column, output_path):
    """
     Trains a Celltypist model using annotated single-cell RNA-seq data and
     saves it to disk.
    Parameters:
    -----------
    adata : AnnData
        An annotated data matrix containing single-cell RNA-seq data.
    cell_type_column : str
        The name of the column in `adata.obs` containing cell type annotations
        used as labels for model training.
    output_path : str
        The file path where the trained model will be saved.

    Description:
    ------------
    This function trains a Celltypist model using the cell type annotations
    provided in the specified column of the `adata.obs` attribute. The trained
    model is saved to the specified `output_path`. The function checks if the
    model has already been trained and cached (tracked in
    `adata.uns['called_functions']`) to avoid redundant computations.

    The training process leverages feature selection and parallel processing
    with 24 jobs for optimized performance.

    Returns:
    --------
    None
         The function does not return any value but saves the trained model to
         the specified location.

    Side Effects:
    -------------
    - Saves the trained model to the specified `output_path`.
    - Updates `adata.uns['called_functions']` to track the function call and
    prevent retraining.
    - Prints status messages during training and saving.
    """
    filtered_vars = {
        k: v for k, v in locals().items() if k != 'adata'}
    call = get_call_signature(function_name='train_celltypist_model',
                              args=filtered_vars)

    # check if the adata has already been annotated
    if 'called_functions' not in adata.uns:
        adata.uns['called_functions'] = []
    elif call in adata.uns['called_functions']:
        print(f"Model: {output_path} already trained")
        return
    print(f"Running Celltypist version {celltypist.__version__}")
    model = celltypist.train(adata, labels=cell_type_column,
                             n_jobs=24, feature_selection=True)
    print(f"Saving model: {output_path}")
    model.write(output_path)
    adata.uns['called_functions'].append(call)
    return


def run_celltypist_annotation(adata, model_file, plot_y_relative=True,
                              plot_plotly=True):
    """
    Runs Celltypist annotation on an adata object and visualizes the results.

    Parameters:
    -----------
    adata : AnnData
        An annotated data matrix containing single-cell RNA-seq data.
    model_file : str
        The path or name of the Celltypist model to use for annotation. If not
        found locally, the function attempts to download the model from the
        Celltypist catalog.
    plot_y_relative : bool, optional
        If True, the resulting cell type distribution is plotted as
        percentages.  If False, absolute counts are plotted. Default is True.
    plot_plotly : bool, optional
        If True, generates an interactive plot using Plotly. If False, creates
        a static plot using Matplotlib. Default is True.

    Description:
    ------------
    This function performs cell type annotation using the specified Celltypist
    model. If the model is not found locally, the function attempts to download
    it from the Celltypist catalog. The annotated cell type labels are added to
    the `adata.obs` object, and the distribution of cell types is visualized as
    a bar plot, either interactively (Plotly) or statically (Matplotlib) using
    the plot_cell_type_dist_bar function.

    Caching ensures that the annotation is not repeated if it has already been
    performed on the same `adata` object. The function utilizes the
    `plot_cell_type_dist_bar` helper to generate the visualization.

    Returns:
    --------
    Result
        Returns a cached or newly generated result containing the annotation
        and plot.

    Side Effects:
    -------------
    - Updates `adata` with annotated cell type labels and stores function call
      metadata in `adata.uns['called_functions']`.
    - Saves plots to disk in 'tmp/celltypist_annotation.html' (Plotly) or
      'tmp/celltypist_annotation.png' (Matplotlib).

    Raises:
    -------
    FileNotFoundError
        If the model file is not found locally and cannot be downloaded.
    ValueError
        If the model file cannot be loaded or is invalid.
    """
    filtered_vars = {
        k: v for k, v in locals().items() if k != 'adata'}
    call = get_call_signature(function_name='run_celltypist_annotation',
                              args=filtered_vars)

    # check if the adata has already been annotated
    if 'called_functions' not in adata.uns:
        adata.uns['called_functions'] = []
    elif call in adata.uns['called_functions']:
        print('Celltypist already performed.')
        return plot_cell_type_dist_bar(adata, plot_y_relative=plot_y_relative,
                                       plot_plotly=plot_plotly)

    try:
        # try if model can be loaded
        celltypist_model = models.Model.load(model=model_file)
        print(f"Loading model >{model_file}<")
    except FileNotFoundError:
        try:
            # If the model file is not found, attempt to download it
            print(f"Model >{model_file}< not found, attempting to download...")
            models.download_models(model=model_file)
            celltypist_model = models.Model.load(model=model_file)
            print(f"Loading model >{model_file}< from celltypist catalogue")
        except ValueError:
            # If the model can't be loaded
            print(f"Model >{model_file}< can't be found or downloaded," +
                  " provide a different model.")
            return adata

    if not (np.allclose(np.expm1(adata.X).sum(axis=1), 10000)):
        print('Normalizing data with log1p  to 10,000 counts per cell...')
        log_normalize(adata)

    # Perform annotation
    try:
        print('Running annotation...')
        predictions = annotate(adata, model=celltypist_model,
                               majority_voting=True, mode='best match')
    except ValueError:
        print('Transposing anndata object, trying to annotate again...')
        adata = adata.T
        predictions = annotate(adata, model=celltypist_model,
                               majority_voting=True, mode='best match')

    # Insert labels into AnnData object
    adata = predictions.to_adata(insert_labels=True)

    adata.uns['called_functions'].append(call)

    return plot_cell_type_dist_bar(adata, plot_y_relative=plot_y_relative,
                                   plot_plotly=plot_plotly)
