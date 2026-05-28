---
name: kegg-analysis
category: data-ai
description: Multi-step KEGG bioinformatics workflows — pathway enrichment from gene lists, drug-target investigation, cross-species metabolic comparison, and compound-reaction network exploration. Guides Claude through the full analytical pipeline using KEGG MCP tools.
---

# KEGG Bioinformatics Analysis

This skill orchestrates multi-step biological analyses using the KEGG MCP server tools. It transforms raw gene lists, drug names, or pathway IDs into structured biological insights.

## When to Use This Skill

- Performing pathway enrichment analysis on a gene list
- Investigating a drug's mechanism of action, targets, and interactions
- Comparing metabolic pathways across species
- Tracing compound-reaction networks
- Mapping genes to functional modules and ortholog groups

## What This Skill Does

1. **Identifies the analysis type** from the user's input (enrichment, drug, comparison, network)
2. **Resolves identifiers** — maps gene symbols, drug names, or pathway IDs to KEGG entries
3. **Retrieves cross-linked data** — follows relationships across KEGG databases
4. **Aggregates and ranks results** — counts pathway hits, scores conservation, groups by function
5. **Synthesizes biological context** — explains significance, not just IDs

## How to Use

### Pathway Enrichment

```
Analyze these genes for pathway enrichment in human: BRCA1, TP53, EGFR, KRAS, PIK3CA
```

Workflow:
1. `search_genes` for each gene in the target organism (e.g., hsa)
2. `get_gene_info` to confirm identity and get KEGG gene IDs
3. `find_related_entries` to get pathway associations per gene
4. Aggregate: count how many input genes map to each pathway
5. `get_pathway_info` for top pathways
6. `render_pathway_ascii` for visual context
7. Report ranked pathways with p-value proxy (gene count / pathway size)

### Drug Target Investigation

```
Investigate metformin: targets, pathways, and interactions
```

Workflow:
1. `search_drugs` to find the KEGG drug entry
2. `get_drug_info` for targets, classification, and metabolism
3. `search_genes` for each target gene
4. `find_related_entries` to get target pathways
5. `get_drug_interactions` for DDI screening
6. Synthesize mechanism-of-action summary

### Cross-Species Comparison

```
Compare glycolysis (map00010) between human, E. coli, and yeast
```

Workflow:
1. `get_pathway_info` for organism-specific variants (hsa00010, eco00010, sce00010)
2. `get_pathway_genes` for each organism
3. `get_gene_orthologs` to identify conserved vs. species-specific enzymes
4. `get_pathway_compounds` to compare metabolite pools
5. `render_pathway_ascii` for each organism
6. Report conservation matrix and unique adaptations

## Example

**User**: "What pathways are enriched in this gene set: SOD1, SOD2, CAT, GPX1, PRDX1?"

**Output**:
```
Pathway Enrichment Results (Homo sapiens)

Top Pathways:
1. hsa04146 Peroxisome (4/5 genes) — organelle for fatty acid oxidation and ROS detox
2. hsa04216 Ferroptosis (3/5 genes) — iron-dependent cell death regulated by GPX
3. hsa05022 Pathways of neurodegeneration (3/5 genes) — oxidative damage in ALS, AD, PD
4. hsa00480 Glutathione metabolism (2/5 genes) — GSH-dependent antioxidant system

Biological Context:
All 5 genes encode antioxidant enzymes. The enrichment in Peroxisome
and Ferroptosis pathways reflects their central role in reactive oxygen
species (ROS) detoxification. The neurodegeneration hit is consistent
with oxidative stress as a driver of SOD1-linked ALS.
```

## Tips

- Provide organism context (human, mouse, E. coli) for faster resolution
- Use standard gene symbols — KEGG resolves HGNC symbols for human
- For large gene lists (>20), batch with `batch_entry_lookup` (max 50 per call)
- Cross-reference with `convert_identifiers` to bridge UniProt, NCBI Gene, or PDB IDs
- Use `find_related_entries` to discover unexpected connections between databases
