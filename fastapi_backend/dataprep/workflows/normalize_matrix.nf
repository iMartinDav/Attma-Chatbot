#!/usr/bin/env nextflow

// Parameters
params.input = ""
params.output_dir = "results"
params.method = "log" // Normalization method: log, tpm, zscore

process normalizeMatrix {
    publishDir params.output_dir, mode: 'copy'
    
    input:
    path matrix_file
    
    output:
    path "normalized_matrix.tsv"
    path "normalization_stats.txt"
    
    script:
    """
    #!/usr/bin/env python3
    import numpy as np
    import pandas as pd
    import gzip
    import os
    import scipy.sparse as sp
    
    def read_matrix(file_path):
        '''Read a matrix file, handling different formats.'''
        is_gzipped = file_path.endswith('.gz')
        opener = gzip.open if is_gzipped else open
        mode = 'rt' if is_gzipped else 'r'
        
        with opener(file_path, mode) as f:
            # Check first line to determine format
            first_line = f.readline().strip()
            f.seek(0)  # Reset to beginning
            
            if len(first_line.split()) == 3 and all(token.isdigit() for token in first_line.split()):
                # Likely a sparse matrix in Matrix Market format
                rows, cols, entries = map(int, first_line.split())
                
                # Skip header and comments
                data = []
                row_indices = []
                col_indices = []
                
                for line in f:
                    if line.startswith(('%', '#')):
                        continue
                        
                    tokens = line.strip().split()
                    if len(tokens) == 3:
                        # i, j, value format (1-indexed)
                        i, j, val = int(tokens[0]), int(tokens[1]), float(tokens[2])
                        row_indices.append(i-1)  # Convert to 0-indexed
                        col_indices.append(j-1)  # Convert to 0-indexed
                        data.append(val)
                
                # Create sparse matrix
                matrix = sp.coo_matrix((data, (row_indices, col_indices)), shape=(rows, cols))
                matrix = matrix.todense()
                
                # Create a DataFrame
                return pd.DataFrame(matrix)
            
            else:
                # Assume tab-delimited full matrix
                return pd.read_csv(file_path, sep='\\t', index_col=0)
    
    def log_normalize(matrix):
        '''Apply log normalization: log2(x + 1).'''
        return np.log2(matrix + 1)
    
    def tpm_normalize(matrix):
        '''Transcripts Per Million normalization.'''
        # Scale factors: sum of each column
        scale_factors = matrix.sum(axis=0)
        # Normalize to counts per million
        normalized = matrix.div(scale_factors) * 1e6
        return normalized
    
    def zscore_normalize(matrix):
        '''Z-score normalization (mean=0, std=1 for each gene).'''
        return (matrix - matrix.mean(axis=1, keepdims=True)) / matrix.std(axis=1, keepdims=True, ddof=1)
    
    # Read the matrix
    try:
        print(f"Reading matrix from {matrix_file}")
        matrix = read_matrix("${matrix_file}")
        
        print(f"Matrix shape: {matrix.shape}")
        
        # Apply normalization
        method = "${params.method}"
        if method == "log":
            normalized = log_normalize(matrix)
            method_name = "Log2(x+1)"
        elif method == "tpm":
            normalized = tpm_normalize(matrix)
            method_name = "Transcripts Per Million (TPM)"
        elif method == "zscore":
            normalized = zscore_normalize(matrix)
            method_name = "Z-score"
        else:
            raise ValueError(f"Unknown normalization method: {method}")
        
        # Save normalized matrix
        normalized.to_csv("normalized_matrix.tsv", sep='\\t')
        
        # Save normalization stats
        with open("normalization_stats.txt", "w") as f:
            f.write(f"Input matrix: ${matrix_file}\\n")
            f.write(f"Normalization method: {method_name}\\n")
            f.write(f"Original matrix shape: {matrix.shape}\\n")
            f.write(f"Normalized matrix shape: {normalized.shape}\\n")
            f.write("\\nOriginal matrix statistics:\\n")
            f.write(f"  Min value: {matrix.min().min()}\\n")
            f.write(f"  Max value: {matrix.max().max()}\\n")
            f.write(f"  Mean value: {matrix.mean().mean()}\\n")
            f.write("\\nNormalized matrix statistics:\\n")
            f.write(f"  Min value: {normalized.min().min()}\\n")
            f.write(f"  Max value: {normalized.max().max()}\\n")
            f.write(f"  Mean value: {normalized.mean().mean()}\\n")
    
    except Exception as e:
        with open("normalization_stats.txt", "w") as f:
            f.write(f"Error normalizing matrix: {str(e)}\\n")
        raise
    """
}

workflow {
    normalizeMatrix(file(params.input))
} 
