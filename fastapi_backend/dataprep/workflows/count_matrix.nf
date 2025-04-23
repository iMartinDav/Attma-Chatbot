#!/usr/bin/env nextflow

nextflow.enable.dsl=2

// Parameters
params.input = ""
params.output_dir = "results"

process countNonZeroValues {
    publishDir params.output_dir, mode: 'copy'
    
    input:
    path matrix_file
    
    output:
    path "count_results.txt"
    
    script:
    """
    #!/usr/bin/env python3
    import gzip
    import os
    
    def count_non_zero(file_path):
        is_gzipped = file_path.endswith('.gz')
        opener = gzip.open if is_gzipped else open
        mode = 'rt' if is_gzipped else 'r'
        
        count = 0
        rows = 0
        with opener(file_path, mode) as f:
            for line in f:
                if line.startswith(('%', '#')):
                    continue
                    
                tokens = line.strip().split()
                if len(tokens) == 3:
                    # Sparse matrix format (count non-zero entries)
                    count += 1
                else:
                    # Full matrix format (count non-zero values)
                    rows += 1
                    for token in tokens[1:]:  # Skip row header if exists
                        try:
                            if float(token) != 0:
                                count += 1
                        except ValueError:
                            pass  # Skip non-numeric values
        
        return count, rows
    
    with open("count_results.txt", "w") as f:
        try:
            count, rows = count_non_zero("${matrix_file}")
            f.write(f"Matrix: ${matrix_file}\\n")
            f.write(f"Non-zero values: {count}\\n")
            f.write(f"Rows processed: {rows}\\n")
        except Exception as e:
            f.write(f"Error processing file: {str(e)}\\n")
    """
}

workflow {
    input_ch = Channel.fromPath(params.input)
    countNonZeroValues(input_ch)
}

// End of script
