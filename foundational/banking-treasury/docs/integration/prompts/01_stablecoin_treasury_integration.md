# Research Prompt: Stablecoin Integration In Corporate Treasury

## Research Objective

Produce a comprehensive technical guide for integrating stablecoin payment rails into enterprise treasury operations, covering reconciliation, accounting, custody, and risk management.

## Context

Our research established that stablecoins function as 24/7 treasury rails with instant finality. Enterprise adoption is accelerating (SpaceX, Scale AI). The GENIUS Act (July 2025) provides regulatory clarity. However, significant operational gaps remain:

1. How do stablecoin payments integrate with Virtual Account Management?
2. What is the proper accounting treatment for stablecoin holdings?
3. How do custodian controls satisfy audit requirements?

## Research Questions

### Section 1: Reconciliation Architecture

**Primary question:** How do organizations map stablecoin payments to existing reconciliation infrastructure?

Investigate:
- Circle Business Account virtual account capabilities
- Fireblocks vault structure and sub-account segregation
- BitGo enterprise wallet segregation
- On-chain address generation strategies
- Memo/reference field standards (if any)
- Payment processor APIs for reconciliation data

**Desired output:**
- Architecture diagram showing stablecoin → reconciliation flow
- Comparison table of approaches (multiple addresses vs. memo fields vs. processor abstraction)
- Vendor capability matrix

### Section 2: Accounting Treatment

**Primary question:** Under current and emerging standards, how should stablecoin treasury holdings be classified?

Investigate:
- FASB ASU 2023-08 applicability to stablecoins (vs. volatile crypto)
- SEC SAB 121 impact on corporate (not custodian) holdings
- GENIUS Act implications for stablecoin classification
- Big 4 accounting firm published guidance
- Peer company 10-K disclosures (any public companies holding operational stablecoins)

**Desired output:**
- Decision tree for stablecoin accounting classification
- Comparison of treatment under: Cash equivalent / Short-term investment / Digital asset
- Draft accounting policy language

### Section 3: Custody and Controls

**Primary question:** What custody and control frameworks satisfy SOX and audit requirements for corporate stablecoin holdings?

Investigate:
- SOC 2 Type II reports from major custodians (Coinbase Prime, Fireblocks, BitGo)
- Segregation of duties in crypto custody
- Multi-signature vs. MPC wallet tradeoffs
- Insurance coverage for custody losses
- Key recovery procedures

**Desired output:**
- Control framework checklist for stablecoin custody
- Custodian comparison matrix
- Sample audit committee presentation points

### Section 4: Risk Management

**Primary question:** What risks are unique to stablecoin treasury operations and how should they be mitigated?

Investigate:
- Issuer risk (Circle vs. Tether backing transparency)
- Redemption risk (terms for converting back to fiat)
- Smart contract risk (bridge vulnerabilities)
- Regulatory risk (post-GENIUS Act stability)
- Operational risk (wallet compromise, key loss)

**Desired output:**
- Risk register specific to stablecoin operations
- Mitigation strategies for each risk
- Suggested concentration limits

## Research Methodology

1. **Primary sources:** FASB, SEC, Federal Reserve publications
2. **Vendor documentation:** Circle, Fireblocks, BitGo, Coinbase Prime
3. **Accounting guidance:** Big 4 publications on crypto accounting
4. **Peer analysis:** Public company filings mentioning stablecoin operations
5. **Industry bodies:** AICPA guidance on digital asset auditing

## Success Criteria

Research is complete when:
- [ ] Reconciliation architecture decision can be made
- [ ] Accounting treatment is clearly determined
- [ ] Custody provider can be evaluated against framework
- [ ] Risk register is actionable
- [ ] All gaps from questions/01 and questions/02 are addressed

## Related Files

- docs/integration/questions/01_virtual_account_stablecoin_integration.md
- docs/integration/questions/02_stablecoin_accounting_treatment.md
- docs/integration/insights/03_stablecoins_are_treasury_rails.md
- docs/research/07_STABLECOIN_CRYPTO.md

---

*Research Priority: HIGH*
*Estimated Effort: 2-3 research sessions*
*Dependencies: None*
