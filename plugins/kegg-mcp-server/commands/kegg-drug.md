---
description: Investigate a drug — targets, pathways, classification, and interactions
category: miscellaneous
argument-hint: <drug_name>
---

# Drug Investigation

Investigate a drug's mechanism of action, targets, and interactions.

1. Call `search_drugs` with: `$ARGUMENTS`
2. Call `get_drug_info` for the top match to retrieve targets, classification, and metabolism.
3. For each target gene listed, call `search_genes` in human (hsa) to get the KEGG gene ID.
4. Call `find_related_entries` to identify pathways each target participates in.
5. Call `get_drug_interactions` to screen for drug-drug interactions.
6. Present a structured report:
   - Drug name, formula, and classification
   - Mechanism of action (from target + pathway data)
   - Target genes and their biological roles
   - Key pathways affected
   - Drug-drug interactions (if any)
   - Suggested follow-ups: "Try `/kegg-pathway` to explore a target pathway in detail."
