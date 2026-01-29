# Open Source Licensing: Copyleft and Compatibility

## Research Question
What are the key open source license types? How do copyleft obligations work? What are the compatibility rules between licenses? How do organizations manage open source compliance?

## Current Model Gap
The current `License` entity focuses on IP licensing between parties but:
- No open source license tracking for software dependencies
- No copyleft obligation monitoring
- No license compatibility checking
- No SBOM (Software Bill of Materials) integration

---

## Key Findings

### Two Paradigms of Open Source

| Type | Philosophy | Key Characteristic |
|------|------------|-------------------|
| **Permissive** | Maximum freedom | Use freely, minimal obligations |
| **Copyleft** | Preserve openness | Derivative works must stay open |

### Major Permissive Licenses

#### MIT License
- **One of the shortest and most permissive**
- Requirements: Include copyright notice and license text
- Allows: Commercial use, modification, distribution, sublicensing
- **Compatible with**: Everything (including proprietary)

#### Apache License 2.0
- Permissive with **patent grant**
- Requirements: Include notice, state changes, include license
- **Patent clause**: Contributors grant patent rights to users
- **Compatible with**: GPLv3, MIT, BSD, proprietary

#### BSD Licenses (2-clause and 3-clause)
- Very permissive, similar to MIT
- 3-clause adds "no endorsement" clause
- Minimal requirements for redistribution

### Major Copyleft Licenses

#### GPL (GNU General Public License)

**GPLv2**:
- Derivative works must be GPL-licensed
- Source code must be provided
- "Viral" - copyleft extends to linked code
- **Not compatible with Apache 2.0**

**GPLv3** (2007):
- Addresses patents, DRM, "Tivoization"
- **Compatible with Apache 2.0** (one-way: can combine, result is GPLv3)
- Anti-patent retaliation clause

**The Copyleft Trigger**:
```
If you DISTRIBUTE software containing GPL code
    → Your entire work must be GPL-licensed
    → Source code must be available
    → Same freedoms must be preserved
```

#### LGPL (Lesser GPL)
- Designed for **libraries**
- Allows proprietary software to **link** to LGPL libraries
- Modifications to LGPL code itself must remain LGPL
- **Key distinction**: Using vs. modifying

#### AGPL (Affero GPL)
- Like GPL but triggers on **network use**
- If users interact over network, source must be available
- Closes the "SaaS loophole"
- **Most restrictive** common copyleft license

### License Compatibility Matrix

```
                    Can combine with...
License         MIT    Apache2   GPLv2   GPLv3   LGPL    AGPL    Proprietary
─────────────────────────────────────────────────────────────────────────────
MIT              ✓       ✓        ✓       ✓       ✓       ✓         ✓
Apache 2.0       ✓       ✓        ✗       ✓       ✓       ✓         ✓
GPLv2            ✓       ✗        ✓       ✗       ✓       ✗         ✗
GPLv3            ✓       ✓        ✗       ✓       ✓       ✓         ✗
LGPL             ✓       ✓        ✓       ✓       ✓       ✓         ✓*
AGPL             ✓       ✓        ✗       ✓       ✓       ✓         ✗

* LGPL allows linking but not incorporation
```

**Key Compatibility Rules**:
1. Permissive licenses are compatible with everything
2. GPL licenses are **one-way compatible** - you can add permissive code, result is GPL
3. GPLv2 and GPLv3 are **mutually incompatible** (unless "or later" clause)
4. Apache 2.0 is incompatible with GPLv2 (patent clause conflict)

### Copyleft Triggers and Boundaries

**What Triggers Copyleft**:
| Action | GPL | LGPL | AGPL |
|--------|-----|------|------|
| Internal use only | No | No | No |
| Distribution to others | Yes | Partial | Yes |
| Network/SaaS deployment | No | No | Yes |
| Static linking | Yes | No* | Yes |
| Dynamic linking | Yes | No | Yes |
| Modification | Yes | Yes (to lib) | Yes |

*LGPL requires users be able to replace the library

### Dual Licensing and License Exceptions

**Dual Licensing**:
- Offer same code under two licenses
- Often: GPL for community, commercial license for paying customers
- Examples: MySQL, Qt

**GPL Exceptions**:
- Some projects add exceptions allowing specific combinations
- "Classpath exception" (Java) allows linking without copyleft
- "GCC Runtime Library Exception" similar

### Open Source Compliance Best Practices

1. **Maintain SBOM** (Software Bill of Materials)
   - Track all dependencies
   - Record license of each component
   - Update with each release

2. **License Scanning**
   - Automated tools: FOSSA, Snyk, Black Duck, Licensee
   - Scan on every build
   - Block incompatible additions

3. **Contribution Policies**
   - CLA (Contributor License Agreement) for accepting contributions
   - DCO (Developer Certificate of Origin) alternative

4. **Inbound vs Outbound**
   - **Inbound**: What licenses are you accepting?
   - **Outbound**: What license are you distributing under?
   - Must be compatible

### 2025-2026 Trends

**OSI Recommendations**:
- For maximum adoption: MIT, Apache-2.0, BSD-2-Clause
- For enforcing openness: GPL-3.0, AGPL-3.0, MPL-2.0
- For no restrictions: Unlicense, CC0-1.0

**AI and Open Source**:
- Debate over whether AI training on open source code triggers copyleft
- Some argue no "distribution" = no trigger
- Others argue model weights are derivative work
- **Unresolved** as of 2026

---

## Domain Model Implications

### New Entity: OpenSourceComponent

```typescript
interface OpenSourceComponent {
  id: string;

  // Component identification
  packageName: string;          // e.g., "lodash"
  packageVersion: string;       // e.g., "4.17.21"
  packageManager: 'npm' | 'pypi' | 'maven' | 'cargo' | 'go' | 'other';
  repositoryUrl?: string;

  // License information
  declaredLicense: string;      // SPDX identifier: "MIT", "Apache-2.0", "GPL-3.0"
  licenseUrl?: string;
  licenseType: 'permissive' | 'weak_copyleft' | 'strong_copyleft' | 'proprietary' | 'unknown';

  // Copyleft specifics
  copyleftTriggers?: CopyleftTrigger[];
  compatibleWithProprietary: boolean;

  // Usage context
  usedInProducts: string[];
  usageType: 'runtime' | 'build_only' | 'dev_only' | 'test_only';
  linkingType?: 'static' | 'dynamic' | 'none';

  // Compliance status
  complianceStatus: 'compliant' | 'needs_review' | 'violation' | 'unknown';
  lastScannedDate?: Date;
}

interface CopyleftTrigger {
  action: 'distribution' | 'network_use' | 'linking' | 'modification';
  triggered: boolean;
  notes?: string;
}
```

### New Entity: SoftwareBillOfMaterials

```typescript
interface SBOM {
  id: string;
  productId: string;
  productVersion: string;
  generatedDate: Date;

  // Components
  components: SBOMComponent[];

  // License summary
  licenseSummary: {
    permissive: number;
    weakCopyleft: number;
    strongCopyleft: number;
    proprietary: number;
    unknown: number;
  };

  // Compliance
  hasLicenseConflicts: boolean;
  conflictDetails?: LicenseConflict[];
  overallComplianceStatus: 'clear' | 'needs_attention' | 'blocked';
}

interface SBOMComponent {
  componentId: string;          // Reference to OpenSourceComponent
  isDirect: boolean;            // Direct dependency vs transitive
  introducedBy?: string;        // Parent component if transitive
}

interface LicenseConflict {
  component1Id: string;
  component2Id: string;
  conflictReason: string;
  resolutionOptions: string[];
}
```

### Integration Points

- **Product/Release Management**: Require SBOM for each release
- **CI/CD Pipeline**: Block builds with license violations
- **Legal Review**: Flag new copyleft dependencies for review
- **Copyright entity**: Track attribution requirements

---

## Sources
- [Apache License Questions - Mend](https://www.mend.io/blog/top-10-apache-license-questions-answered/)
- [Open Source License Comparison - Wikipedia](https://en.wikipedia.org/wiki/Comparison_of_free_and_open-source_software_licenses)
- [License Compatibility - Wikipedia](https://en.wikipedia.org/wiki/License_compatibility)
- [GPL Apache Compatibility - Apache Foundation](https://www.apache.org/licenses/GPL-compatibility.html)
- [Copyleft Legal Guide - Doklestic Law](https://doklestic.law/2024/08/01/copyleft-conundrum-legal-guide-to-open-source-software-licensing/)
- [Open Source Licenses Guide - ITMediaLaw](https://itmedialaw.com/en/open-source-licenses-gpl-agpl-mit-and-apache/)
- [47 Open Source Licenses 2025 - MerginIT](https://merginit.com/blog/01082025-47-open-source-licenses-2025)
- [.NET License Compatibility Guide](https://dotnetfoundation.org/news-events/detail/license-compatibility-guide)

---

## Research Date
2026-01-27
