---
description: Search the KEGG bioinformatics database for pathways, genes, compounds, drugs, enzymes, or diseases
category: miscellaneous
argument-hint: <query>
---

# KEGG Search

Search the KEGG database for the user's query.

1. Determine the most relevant KEGG category from the query:
   - Biological processes/signaling → search_pathways
   - Gene names/symbols/organisms → search_genes
   - Chemical names/formulas → search_compounds
   - Enzyme names/EC numbers → search_enzymes
   - Reaction descriptions → search_reactions
   - Disease names/symptoms → search_diseases
   - Drug names/trade names → search_drugs
   - Functional modules → search_modules
   - Ortholog groups → search_ko_entries
   - Sugar structures → search_glycans
2. Call the appropriate search tool with: `$ARGUMENTS`
3. Display results as a compact numbered list with IDs and descriptions
4. End with: "Say a number or ID to get full details, or refine your search."

If the user picks a number, call the corresponding get_*_info tool for that entry.
