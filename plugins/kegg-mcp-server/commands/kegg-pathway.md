---
description: Deep-dive into a KEGG pathway — genes, compounds, reactions, and ASCII visualization
category: miscellaneous
argument-hint: <pathway_id_or_name>
---

# Pathway Deep-Dive

Provide a comprehensive overview of a KEGG pathway.

1. If `$ARGUMENTS` looks like a pathway ID (e.g., hsa00010, map00010), use it directly. Otherwise call `search_pathways` with the argument as a keyword and pick the top result.
2. Call `get_pathway_info` with full detail.
3. Call `get_pathway_genes` to list key enzymes.
4. Call `get_pathway_compounds` to list metabolites.
5. Call `render_pathway_ascii` in chain mode for an overview diagram.
6. Present a structured summary:
   - Pathway name and organism
   - Biological function (1-2 sentences)
   - Key enzymes (with EC numbers)
   - Key metabolites
   - ASCII diagram
   - Related diseases or drugs (if any in the pathway data)
   - Suggested follow-ups: "Try `/kegg-drug` for drugs targeting this pathway, or ask for a cross-species comparison."
