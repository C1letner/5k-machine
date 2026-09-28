# Build 033 — Multiple Testing / False Discovery Control

Method: Benjamini-Hochberg false discovery rate control.
Initial FDR alpha: 10%.

Why FDR instead of Bonferroni:
The Discovery Laboratory intentionally scans broadly. Bonferroni controls any false positive in the entire family and can become excessively restrictive at industrial search scale. BH instead controls the expected proportion of false discoveries among accepted discoveries.

V1 computes a two-sided binomial-normal approximation p-value from discovery-stage win rate and sample size, then applies BH across the discovery-pass family.

This is an additional gate, not proof of profitability. Effect size, transaction costs, median behavior, outlier dependence, holdout and forward validation remain mandatory.

Future versions should use return-distribution-aware/bootstrap/permutation p-values rather than win-rate approximation.

FDR acceptance never grants capital authority.
