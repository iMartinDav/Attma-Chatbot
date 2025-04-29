"""
Unit tests for the BioPython integration layer.
"""

import unittest
import tempfile
import os
from unittest.mock import MagicMock, patch
import numpy as np
import pandas as pd
import json
from io import StringIO

from dataprep.biodata.bio_integrations import (
    BioPythonAdapter, FileFormat, SequenceTools, AlignmentUtils
)


class TestBioPythonIntegration(unittest.TestCase):
    """Test suite for BioPython integration."""
    
    def setUp(self):
        """Set up test fixtures before each test method is run."""
        self.adapter = BioPythonAdapter()
        
        # Create a small FASTA file for testing
        self.fasta_content = ">test1\nACGT\n>test2\nGTCA\n>test3\nTGAC\n"
        with tempfile.NamedTemporaryFile(suffix='.fasta', delete=False) as f:
            f.write(self.fasta_content.encode('utf-8'))
            self.test_fasta_file = f.name
            
        # Create a small GenBank file for testing
        self.genbank_content = """LOCUS       TestSeq         10 bp    DNA     linear   UNA 01-JAN-2025
DEFINITION  Test sequence for unit tests.
ACCESSION   TEST12345
VERSION     TEST12345.1
SOURCE      Test organism
  ORGANISM  Test organism
            Unclassified.
REFERENCE   1  (bases 1 to 10)
  AUTHORS   Test Author
  TITLE     Test Title
  JOURNAL   Test Journal
FEATURES             Location/Qualifiers
     source          1..10
                     /organism="Test organism"
                     /mol_type="genomic DNA"
     gene            2..8
                     /gene="testGene"
     CDS             2..8
                     /gene="testGene"
                     /product="test protein"
                     /translation="TEST"
ORIGIN
        1 acgtacgtac
//
"""
        with tempfile.NamedTemporaryFile(suffix='.gbk', delete=False) as f:
            f.write(self.genbank_content.encode('utf-8'))
            self.test_genbank_file = f.name
            
        # Create a small CSV file with expression data
        self.csv_content = "gene_id,sample1,sample2,sample3\n" + \
                           "gene1,1.0,2.0,3.0\n" + \
                           "gene2,4.0,5.0,6.0\n" + \
                           "gene3,7.0,8.0,9.0\n"
        with tempfile.NamedTemporaryFile(suffix='.csv', delete=False) as f:
            f.write(self.csv_content.encode('utf-8'))
            self.test_csv_file = f.name
    
    def tearDown(self):
        """Tear down test fixtures after each test method is run."""
        # Remove test files
        for file_path in [self.test_fasta_file, self.test_genbank_file, self.test_csv_file]:
            if os.path.exists(file_path):
                os.unlink(file_path)
    
    def test_file_format_detection(self):
        """Test format detection from file extension and content."""
        # Test by file extension
        self.assertEqual(self.adapter.detect_format(self.test_fasta_file), FileFormat.FASTA)
        self.assertEqual(self.adapter.detect_format(self.test_genbank_file), FileFormat.GENBANK)
        self.assertEqual(self.adapter.detect_format(self.test_csv_file), FileFormat.CSV)
        
        # Test with unknown extension
        with tempfile.NamedTemporaryFile(suffix='.unknown') as f:
            f.write(self.fasta_content.encode('utf-8'))
            f.flush()
            # Should examine content when extension is unknown
            self.assertEqual(self.adapter.detect_format(f.name), FileFormat.FASTA)
        
        # Test with content that doesn't match extension
        with tempfile.NamedTemporaryFile(suffix='.csv') as f:
            f.write(self.fasta_content.encode('utf-8'))
            f.flush()
            # Should return FASTA despite the .csv extension
            self.assertEqual(self.adapter.detect_format(f.name, check_content=True), FileFormat.FASTA)
    
    def test_sequence_parsing(self):
        """Test sequence parsing from various formats."""
        # Parse FASTA sequences
        sequences = self.adapter.parse_sequences(self.test_fasta_file)
        
        # Verify sequences were parsed correctly
        self.assertEqual(len(sequences), 3)
        self.assertEqual(sequences[0]["id"], "test1")
        self.assertEqual(sequences[0]["sequence"], "ACGT")
        self.assertEqual(sequences[1]["id"], "test2")
        self.assertEqual(sequences[1]["sequence"], "GTCA")
        
        # Parse GenBank sequences
        gb_sequences = self.adapter.parse_sequences(self.test_genbank_file, format=FileFormat.GENBANK)
        
        # Verify sequences were parsed correctly
        self.assertEqual(len(gb_sequences), 1)
        self.assertEqual(gb_sequences[0]["id"], "TEST12345.1")
        self.assertEqual(gb_sequences[0]["sequence"].upper(), "ACGTACGTAC")
        
        # Check for features
        self.assertTrue("features" in gb_sequences[0])
        found_gene = False
        for feature in gb_sequences[0]["features"]:
            if feature["type"] == "gene" and feature["qualifiers"].get("gene") == ["testGene"]:
                found_gene = True
                
        self.assertTrue(found_gene, "Gene feature not found in GenBank sequence")
    
    def test_sequence_writing(self):
        """Test writing sequences to file."""
        # Create test sequences
        sequences = [
            {"id": "seq1", "sequence": "ACGT", "description": "Test sequence 1"},
            {"id": "seq2", "sequence": "TGCA", "description": "Test sequence 2"}
        ]
        
        # Write to a temporary FASTA file
        with tempfile.NamedTemporaryFile(suffix='.fasta') as f:
            self.adapter.write_sequences(sequences, f.name)
            
            # Read the file back
            with open(f.name, 'r') as handle:
                content = handle.read()
                
            # Check the content
            self.assertTrue(">seq1 Test sequence 1" in content)
            self.assertTrue("ACGT" in content)
            self.assertTrue(">seq2 Test sequence 2" in content)
            self.assertTrue("TGCA" in content)
    
    def test_expression_data_parsing(self):
        """Test parsing expression data from CSV format."""
        # Parse expression data
        data = self.adapter.parse_expression_data(self.test_csv_file)
        
        # Verify the data format
        self.assertTrue(isinstance(data, pd.DataFrame))
        self.assertEqual(data.shape, (3, 3))  # 3 genes, 3 samples
        
        # Verify column names
        self.assertTrue("sample1" in data.columns)
        self.assertTrue("sample2" in data.columns)
        self.assertTrue("sample3" in data.columns)
        
        # Verify values
        self.assertEqual(data.loc["gene1", "sample1"], 1.0)
        self.assertEqual(data.loc["gene2", "sample2"], 5.0)
        self.assertEqual(data.loc["gene3", "sample3"], 9.0)
    
    def test_sequence_tools(self):
        """Test sequence manipulation tools."""
        # Create a sequence tools instance
        seq_tools = SequenceTools()
        
        # Test reverse complement
        self.assertEqual(seq_tools.reverse_complement("ACGT"), "ACGT")
        self.assertEqual(seq_tools.reverse_complement("AATGCC"), "GGCATT")
        
        # Test GC content calculation
        self.assertEqual(seq_tools.gc_content("ACGT"), 0.5)  # 2 out of 4 bases are G/C
        self.assertEqual(seq_tools.gc_content("AAAAAA"), 0.0)  # No G/C bases
        self.assertEqual(seq_tools.gc_content("GCGCGC"), 1.0)  # All G/C bases
        
        # Test translation
        self.assertEqual(seq_tools.translate_dna("ATGTTT"), "MF")  # ATG = M, TTT = F
        self.assertEqual(seq_tools.translate_dna("ATGTTTTAG"), "MF*")  # TAG = stop codon
        
        # Test finding ORFs
        orfs = seq_tools.find_orfs("ATGAAATAGATGACCTAA")
        self.assertTrue(len(orfs) >= 1)
        self.assertEqual(orfs[0]["sequence"], "ATGAAATAG")  # First ORF
    
    def test_alignment_utils(self):
        """Test sequence alignment utilities."""
        # Create alignment utils instance
        align_utils = AlignmentUtils()
        
        # Test pairwise alignment
        seq1 = "ACGTACGT"
        seq2 = "ACGACGT"  # Missing a T
        
        alignment = align_utils.pairwise_align(seq1, seq2)
        self.assertTrue(isinstance(alignment, dict))
        self.assertTrue("aligned1" in alignment)
        self.assertTrue("aligned2" in alignment)
        self.assertTrue("score" in alignment)
        
        # The aligned sequences should have the same length
        self.assertEqual(len(alignment["aligned1"]), len(alignment["aligned2"]))
        
        # Test multiple sequence alignment
        sequences = [
            {"id": "seq1", "sequence": "ACGTACGT"},
            {"id": "seq2", "sequence": "ACGACGT"},
            {"id": "seq3", "sequence": "ACGTACGTA"}
        ]
        
        msa = align_utils.multiple_align(sequences)
        self.assertTrue(isinstance(msa, list))
        self.assertEqual(len(msa), 3)
        
        # All aligned sequences should have the same length
        alignment_length = len(msa[0]["aligned_sequence"])
        for seq in msa:
            self.assertEqual(len(seq["aligned_sequence"]), alignment_length)


if __name__ == "__main__":
    unittest.main()