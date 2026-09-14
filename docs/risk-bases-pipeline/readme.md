# Risk-Based DevSecOps Pipeline

## 1. Objetivo

Diseñar e implementar una capa de **Risk Assessment** sobre un pipeline DevSecOps ejecutado mediante **GitHub Actions**.

El pipeline debe ejecutar diferentes controles de seguridad y calidad:

* Unit Tests
* Integration Tests
* SAST
* SCA
* Secret Scanning
* AI Code Review

Los scanners generan hallazgos, pero el objetivo de este proyecto es agregar una capa adicional que permita:

1. Normalizar los findings provenientes de diferentes herramientas.
2. Clasificarlos.
3. Enriquecerlos con contexto de la aplicación.
4. Calcular un riesgo basado en **OWASP Risk Rating**.
5. Aplicar políticas de decisión.
6. Determinar si un Pull Request:

   * puede continuar,
   * debe generar warning,
   * requiere revisión,
   * o debe bloquearse.
7. Mostrar claramente el resultado en GitHub.

La filosofía principal es:

> **Security tools detect vulnerabilities. Risk assessment determines how important they are for the organization.**

---

# 2. Arquitectura general

El pipeline debe seguir conceptualmente esta arquitectura:

```text
                         Pull Request
                              │
                              ▼
                    ┌──────────────────┐
                    │   GitHub Actions │
                    └────────┬─────────┘
                             │
             ┌───────────────┼────────────────┐
             │               │                │
             ▼               ▼                ▼
        Unit Tests      Integration Tests   Security
                                              │
                             ┌────────────────┼───────────────┐
                             ▼                ▼               ▼
                            SAST             SCA       Secret Scanning
                             │                │               │
                             └────────────────┼───────────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │ Finding          │
                                    │ Normalization    │
                                    └────────┬─────────┘
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │ Risk Assessment  │
                                    │ Engine           │
                                    └────────┬─────────┘
                                             │
                         ┌───────────────────┼───────────────────┐
                         │                   │                   │
                         ▼                   ▼                   ▼
                   Likelihood              Impact          Business Context
                         │                   │                   │
                         └───────────────────┼───────────────────┘
                                             ▼
                                    ┌──────────────────┐
                                    │ Final Risk       │
                                    │ Rating           │
                                    └────────┬─────────┘
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │ Policy Engine    │
                                    └────────┬─────────┘
                                             │
                         ┌───────────────────┼───────────────────┐
                         ▼                   ▼                   ▼
                       PASS                WARN                BLOCK
```

---

# 3. Principio fundamental

No se debe utilizar únicamente la severidad proporcionada por un scanner.

Por ejemplo:

```text
SAST finding
CWE-89
Severity: HIGH
```

no necesariamente significa que el riesgo organizacional sea HIGH.

El sistema debe considerar contexto.

Ejemplo:

```text
CWE-89
+
Internet exposed
+
Production
+
Payment API
+
Financial data
+
PII
```

puede resultar en:

```text
FINAL RISK = CRITICAL
```

Mientras que:

```text
CWE-89
+
Internal development tool
+
No sensitive data
+
Not production
```

podría resultar en:

```text
FINAL RISK = MEDIUM
```

---

# 4. Separación entre Severity y Risk

El sistema debe distinguir claramente:

## Severity

Describe qué tan grave es técnicamente el finding.

Puede venir de:

* CVSS
* SAST scanner
* SCA scanner
* Secret scanner

Ejemplo:

```text
CVSS = 9.8
Severity = Critical
```

## Risk

Describe qué tan importante es el finding para nuestra organización.

Debe considerar:

```text
Technical severity
+
Likelihood
+
Application context
+
Business impact
+
Exposure
+
Data sensitivity
```

Por lo tanto:

```text
Severity != Risk
```

---

# 5. Fuentes de findings

El sistema debe poder consumir findings provenientes de diferentes fuentes.

Inicialmente considerar:

### SAST

Ejemplos:

```text
Semgrep
CodeQL
SonarQube
```

Los findings normalmente deben conservar:

```text
CWE
Rule ID
File
Line
Message
Severity
```

---

### SCA

Ejemplos:

```text
Dependabot
Snyk
Trivy
OWASP Dependency-Check
```

Los findings deben conservar, cuando estén disponibles:

```text
CVE
CVSS
Package
Installed version
Fixed version
Severity
Exploit information
```

---

### Secret Scanning

Ejemplos:

```text
GitHub Secret Scanning
Gitleaks
TruffleHog
```

Los findings deben conservar:

```text
Secret type
File
Line
Detection source
Validity status
```

Nunca se debe almacenar el valor real del secret.

---

# 6. Finding Normalization

Crear un modelo interno común para todos los findings.

Por ejemplo:

```json
{
  "id": "finding-123",
  "source": "SAST",
  "scanner": "semgrep",

  "rule": {
    "id": "javascript.sql-injection",
    "cwe": ["CWE-89"],
    "owasp": ["A05:2025"]
  },

  "severity": {
    "scanner": "HIGH",
    "cvss": null
  },

  "location": {
    "repository": "payments-api",
    "file": "src/payments/payment.service.ts",
    "line": 142
  },

  "asset": {
    "environment": "production",
    "internet_exposed": true,
    "business_criticality": "HIGH"
  },

  "data": {
    "pii": true,
    "financial": true,
    "credentials": false
  }
}
```

Este modelo debe ser independiente del scanner.

El Risk Engine no debería necesitar saber si el finding provino de Semgrep, CodeQL, Snyk o Gitleaks.

---

# 7. Application Context

El sistema debe permitir definir metadata de cada aplicación.

Ejemplo:

```yaml
application:
  name: payments-api

  business_criticality: HIGH

  environments:
    production:
      internet_exposed: true

  data_classification:
    pii: true
    financial: true
    credentials: false

  compliance:
    pci_dss: true
    soc2: true
```

Esto permitirá que el Risk Engine evalúe el contexto.

---

# 8. Likelihood

Implementar el concepto de **Likelihood** basado en OWASP Risk Rating.

Debe considerar dos grupos.

## Threat Agent Factors

```text
Skill Level
Motive
Opportunity
Size
```

Cada factor utiliza una escala de:

```text
0 - 9
```

---

## Vulnerability Factors

```text
Ease of Discovery
Ease of Exploit
Awareness
Intrusion Detection
```

También:

```text
0 - 9
```

Calcular un valor agregado para:

```text
Threat Agent
```

y:

```text
Vulnerability
```

y finalmente:

```text
Likelihood
```

El sistema debe conservar los valores individuales para poder explicar cómo se obtuvo el resultado.

Ejemplo:

```json
{
  "likelihood": {
    "score": 8.4,
    "level": "HIGH",

    "threat_agent": {
      "skill": 6,
      "motive": 9,
      "opportunity": 9,
      "size": 9
    },

    "vulnerability": {
      "discovery": 9,
      "exploit": 9,
      "awareness": 9,
      "detection": 8
    }
  }
}
```

---

# 9. Impact

El Risk Engine debe calcular Impact.

Debe contemplar:

## Technical Impact

```text
Confidentiality
Integrity
Availability
Accountability
```

Escala:

```text
0 - 9
```

---

## Business Impact

Debe permitir incorporar factores específicos de la organización.

Por ejemplo:

```text
Financial Damage
Reputation Damage
Compliance
Privacy
Business Continuity
```

Escala:

```text
0 - 9
```

Ejemplo:

```json
{
  "impact": {
    "score": 8.7,
    "level": "HIGH",

    "technical": {
      "confidentiality": 9,
      "integrity": 7,
      "availability": 5,
      "accountability": 8
    },

    "business": {
      "financial": 8,
      "reputation": 9,
      "compliance": 8,
      "privacy": 8,
      "business_continuity": 6
    }
  }
}
```

---

# 10. OWASP Risk Rating

Implementar la lógica:

```text
Risk = Likelihood × Impact
```

La implementación debe conservar tanto los scores numéricos como los niveles:

```text
LOW
MEDIUM
HIGH
```

Para ambos:

```text
Likelihood
Impact
```

Después utilizar una matriz de decisión.

Ejemplo:

| Impact | Low Likelihood | Medium Likelihood | High Likelihood |
| ------ | -------------- | ----------------- | --------------- |
| Low    | Note           | Low               | Medium          |
| Medium | Low            | Medium            | High            |
| High   | Medium         | High              | Critical        |

El resultado debe ser:

```text
NOTE
LOW
MEDIUM
HIGH
CRITICAL
```

---

# 11. Contextual Risk

Además del cálculo OWASP, implementar una capa de contexto organizacional.

Debe poder considerar:

```text
Internet Exposure
Production Environment
Authentication Required
Asset Criticality
Data Sensitivity
Financial Data
PII
Credentials
Compliance Requirements
Existing Security Controls
```

Ejemplo:

```json
{
  "context": {
    "internet_exposed": true,
    "production": true,
    "authentication_required": false,
    "asset_criticality": "HIGH",
    "contains_pii": true,
    "contains_financial_data": true,
    "pci_scope": true
  }
}
```

---

# 12. Final Risk

El sistema debe producir un resultado final explicable.

Ejemplo:

```json
{
  "finding_id": "finding-123",

  "classification": {
    "type": "SAST",
    "cwe": "CWE-89"
  },

  "severity": {
    "scanner": "HIGH"
  },

  "likelihood": {
    "score": 8.4,
    "level": "HIGH"
  },

  "impact": {
    "score": 8.7,
    "level": "HIGH"
  },

  "owasp_risk": {
    "level": "CRITICAL"
  },

  "final_risk": {
    "level": "CRITICAL"
  }
}
```

La salida debe explicar **por qué** se obtuvo ese riesgo.

---

# 13. Policy Engine

Crear un sistema de políticas configurable.

Ejemplo:

```yaml
risk_policy:

  critical:
    action: BLOCK
    approval_required: true

  high:
    action: BLOCK

  medium:
    action: WARN

  low:
    action: ALLOW

  note:
    action: ALLOW
```

La política debe poder configurarse por repositorio.

Idealmente:

```yaml
policy:
  critical:
    action: block

  high:
    action: block

  medium:
    action: warning

  low:
    action: allow
```

---

# 14. Exceptions / Risk Acceptance

El sistema debe permitir excepciones controladas.

Ejemplo:

```yaml
exceptions:

  - finding_id: finding-123

    reason: "False positive confirmed by security team"

    approved_by: security-team

    expires_at: "2026-12-31"

    compensating_controls:
      - "WAF rule"
      - "Network restriction"
```

Las excepciones deben:

* Tener justificación.
* Tener expiración.
* Tener responsable.
* Quedar registradas.
* No eliminar el finding original.

Nunca debe existir:

```yaml
ignore: true
```

sin justificación.

---

# 15. GitHub Actions

Crear un workflow:

```text
.github/workflows/security.yml
```

Debe ejecutar conceptualmente:

```yaml
jobs:

  tests:
    runs-on: ubuntu-latest

  sast:
    runs-on: ubuntu-latest

  sca:
    runs-on: ubuntu-latest

  secrets:
    runs-on: ubuntu-latest

  risk-assessment:
    needs:
      - tests
      - sast
      - sca
      - secrets

  security-gate:
    needs:
      - risk-assessment
```

El Risk Engine debe ejecutarse después de que los scanners generen sus resultados.

---

# 16. Pipeline esperado

El pipeline completo debe verse aproximadamente así:

```text
PR
 │
 ▼
Checkout
 │
 ├── Unit Tests
 │
 ├── Integration Tests
 │
 ├── SAST
 │
 ├── SCA
 │
 └── Secret Scanning
          │
          ▼
     Raw Findings
          │
          ▼
   Finding Normalizer
          │
          ▼
   Context Enrichment
          │
          ▼
    OWASP Risk Engine
          │
          ▼
     Policy Engine
          │
          ▼
   GitHub Security Gate
          │
       ┌──┴───┐
       ▼      ▼
     PASS    BLOCK
```

---

# 17. GitHub PR Output

El pipeline debe publicar un resumen en el Pull Request.

Ejemplo:

```text
## 🔐 Security Risk Assessment

Findings: 7

| Source | Finding | Severity | Risk | Action |
|---|---|---|---|---|
| SAST | CWE-89 | High | Critical | BLOCK |
| SCA | CVE-2026-1234 | High | High | BLOCK |
| SAST | XSS | Medium | Medium | WARN |
| Secrets | API Key | Critical | Critical | BLOCK |

### Result

❌ Pull Request BLOCKED

Critical findings: 2
High findings: 1
Medium findings: 1
Low findings: 3
```

---

# 18. Explainability

Uno de los requisitos más importantes es que el sistema sea explicable.

No debe responder únicamente:

```text
Risk = Critical
```

Debe responder:

```text
Risk = Critical

Reasons:

+ Internet exposed
+ Production environment
+ Payment API
+ Financial data
+ PII
+ Exploit is relatively easy
+ Publicly known vulnerability

Likelihood: HIGH
Impact: HIGH

Recommended action: BLOCK
```

---

# 19. AI Code Reviewer

El sistema debe ser compatible con un AI Code Reviewer.

El AI reviewer debe poder recibir:

```text
Pull Request
+
Ticket / Requirement
+
Changed files
+
Security findings
```

Y generar recomendaciones de:

```text
Code Quality
Security
Architecture
Maintainability
Potential Vulnerabilities
Requirement Compliance
```

Pero el AI reviewer **no debe reemplazar SAST/SCA**.

Debe funcionar como una capa adicional:

```text
AI Review
     +
SAST
     +
SCA
     +
Secret Scanning
     +
Risk Engine
```

El AI puede proporcionar contexto y explicaciones, pero las decisiones críticas de seguridad deben basarse en reglas determinísticas y configurables.

---

# 20. Ejemplo completo

Supongamos que SAST encuentra:

```text
SQL Injection

CWE-89
Severity: HIGH
```

El normalizer genera:

```json
{
  "type": "SAST",
  "cwe": "CWE-89",
  "severity": "HIGH"
}
```

Context enrichment:

```json
{
  "internet_exposed": true,
  "production": true,
  "authentication_required": false,
  "asset_criticality": "HIGH",
  "financial_data": true,
  "pii": true
}
```

Risk Engine:

```text
Likelihood = HIGH
Impact = HIGH

OWASP Risk = CRITICAL
```

Policy:

```text
CRITICAL → BLOCK
```

GitHub:

```text
❌ Security Gate Failed

CWE-89 SQL Injection

Risk: CRITICAL

The affected endpoint is:
- Internet exposed
- Production
- Financial-data processing
- PII capable

PR cannot be merged.
```

---

# 21. Important Design Principle

No utilizar un único número mágico para determinar riesgo.

Evitar algo como:

```text
risk_score = scanner_score * 2
```

El sistema debe ser:

* Explicable.
* Auditable.
* Configurable.
* Determinístico.
* Reproducible.
* Independiente del scanner.
* Basado en contexto.
* Compatible con diferentes organizaciones.

---

# 22. Desired Project Structure

Proponer una estructura similar a:

```text
risk-engine/
│
├── src/
│   ├── domain/
│   │   ├── finding/
│   │   ├── likelihood/
│   │   ├── impact/
│   │   ├── risk/
│   │   └── policy/
│   │
│   ├── parsers/
│   │   ├── sast/
│   │   ├── sca/
│   │   └── secrets/
│   │
│   ├── context/
│   │
│   ├── engine/
│   │
│   ├── policy/
│   │
│   └── output/
│
├── config/
│   ├── risk-policy.yml
│   └── application.yml
│
├── tests/
│
├── .github/
│   └── workflows/
│       └── security.yml
│
└── README.md
```

---

# 23. Technology

Preferentemente implementar el Risk Engine en:

```text
Node.js
TypeScript
```

El proyecto debe ser fácilmente integrable con aplicaciones backend existentes.

Si se considera que otra tecnología es significativamente mejor, explicar primero por qué.

---

# 24. Testing

Crear tests unitarios para:

### Likelihood

```text
Low
Medium
High
```

### Impact

```text
Low
Medium
High
```

### Risk Matrix

Probar todas las combinaciones:

```text
Low × Low
Low × Medium
Low × High

Medium × Low
Medium × Medium
Medium × High

High × Low
High × Medium
High × High
```

### Policy

Probar:

```text
Critical → Block
High → Block
Medium → Warn
Low → Allow
```

### Context

Probar diferentes aplicaciones:

```text
Public API
Internal API
Payment API
Admin API
Development tool
```

---

# 25. Security Requirements

El sistema debe:

* Nunca registrar secretos.
* Nunca imprimir tokens.
* Nunca almacenar passwords.
* Sanitizar outputs de scanners.
* Validar todos los archivos de entrada.
* Evitar command injection al ejecutar scanners.
* Evitar path traversal.
* Validar YAML/JSON.
* Usar dependencias actualizadas.
* Ejecutarse con permisos mínimos en GitHub Actions.

---

# 26. Desired Deliverables

La IA que implemente este proyecto debe entregar:

### 1. Architecture

Explicar la arquitectura completa.

### 2. Data model

Definir los modelos TypeScript:

```text
Finding
AssetContext
Likelihood
Impact
RiskAssessment
RiskPolicy
Exception
```

### 3. Risk Engine

Implementar el cálculo de:

```text
Likelihood
Impact
OWASP Risk
Final Risk
```

### 4. Parsers

Crear parsers iniciales para findings normalizados.

Como mínimo:

```text
SAST
SCA
Secret Scanning
```

### 5. Configuration

Crear:

```text
risk-policy.yml
application.yml
```

### 6. GitHub Actions

Crear:

```text
.github/workflows/security.yml
```

### 7. GitHub PR integration

Generar:

```text
PR comment
GitHub Check
Exit code
```

Por ejemplo:

```text
exit 0 → PASS
exit 1 → BLOCK
```

### 8. Tests

Crear tests unitarios y de integración.

### 9. Example

Incluir un ejemplo completo:

```text
SAST finding
→ normalization
→ context enrichment
→ OWASP Risk Rating
→ policy
→ GitHub decision
```

---

# 27. Expected CLI

Crear una interfaz CLI sencilla.

Ejemplo:

```bash
risk-engine analyze \
  --findings findings.json \
  --context application.yml \
  --policy risk-policy.yml
```

Output:

```text
Security Risk Assessment

Findings: 7

Critical: 2
High:     1
Medium:   2
Low:      2

Final Decision: BLOCK

Exit code: 1
```

También permitir:

```bash
risk-engine explain finding-123
```

Output:

```text
Finding: CWE-89 SQL Injection

Likelihood: HIGH
Impact: HIGH

Risk: CRITICAL

Reasons:
- Internet exposed
- Production
- Financial data
- PII
- Exploit is easy

Recommendation:
Use parameterized queries.
```

---

# 28. Important distinction

El sistema debe diferenciar claramente estas capas:

```text
                    DETECTION
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
         SAST          SCA       Secrets
          │            │            │
          └────────────┼────────────┘
                       ▼
                  CLASSIFICATION
                       │
              CVE / CWE / CVSS
                       │
                       ▼
                    CONTEXT
                       │
           Application / Business
                       │
                       ▼
                  RISK RATING
                       │
                OWASP methodology
                       │
                       ▼
                    POLICY
                       │
                PASS / WARN / BLOCK
```

No mezclar estas responsabilidades.

---

# 29. Goal

El resultado final debe ser un **Risk-Based DevSecOps Pipeline**, no simplemente un conjunto de scanners.

La meta es que una organización pueda responder:

> "Tenemos una vulnerabilidad, ¿qué tan importante es para nosotros y qué debemos hacer al respecto?"

El pipeline debe ser capaz de transformar:

```text
Raw Security Finding
```

en:

```text
Normalized Finding
        ↓
Security Classification
        ↓
Application Context
        ↓
Likelihood
        ↓
Impact
        ↓
OWASP Risk Rating
        ↓
Business Risk
        ↓
Policy Decision
        ↓
PASS / WARN / BLOCK
```

La implementación debe priorizar **claridad, explicabilidad, auditabilidad y facilidad de integración con GitHub Actions**.
