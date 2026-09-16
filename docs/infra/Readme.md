# Pipeline CI/CD

```
Developer
    │
    ▼
GitHub
    │
    ▼
Pull Request
    │
    ├── Unit Tests
    ├── Integration Tests
    ├── SAST
    ├── SCA
    ├── Secret Scanning
    ├── IaC Scanning
    └── AI Code Review
             │
             ▼
         APPROVED
             │
             ▼
       Docker Build
             │
             ▼
      Container Scan
             │
             ▼
            ECR
             │
             ▼
       Deploy to EKS
             │
             ▼
       Kubernetes
        ┌────┴────┐
        │         │
      Pod 1     Pod 2
        │         │
        └────┬────┘
             │
             ▼
          RDS
       PostgreSQL
```

## Estado real vs. diagrama

| Paso del diagrama | Workflow | Estado |
|---|---|---|
| Unit Tests | `unit-tests.yml` | ✅ implementado |
| Integration Tests | `integration-tests.yml` | ✅ implementado |
| SAST | `codeql.yml` | ✅ implementado |
| SCA | `dependency-review.yml` | ✅ implementado |
| Secret Scanning | `secret-scanning.yml` | ✅ implementado |
| AI Code Review | `risk-assessment.yml` → `trigger-cubic-review.js` | ✅ implementado |
| Container Scan | `deploy-ecr.yml` (Trivy, antes del `docker push`) | ✅ implementado |
| IaC Scanning | — | ⏳ pendiente, no existe workflow todavía |

Hasta que este último exista como workflow real, no debería citarse como control activo fuera de este documento (por ejemplo en el README o en una entrega a revisión de seguridad) — el diagrama describe la arquitectura objetivo, no necesariamente el estado actual.

## Qué es lo que realmente bloquea un merge a `main`

`SAST`, `SCA`, `Secret Scanning` y `Threat Model` corren en paralelo sobre el Pull Request. `risk-assessment.yml` espera a que las cuatro terminen (`wait-for-security-workflows.js`) y publica un Check Run llamado **`Security Risk Gate`** con el veredicto consolidado (CVSS + EPSS vía `risk-engine`).

Ese Check Run **no bloquea nada por sí mismo**: el bloqueo real depende de que esté configurado como *required status check* en la protección de la rama `main` (GitHub → Settings → Branches). Esa configuración vive fuera del repositorio, así que queda documentada acá para que sea auditable:

- Required status checks: `Security Risk Gate`, `Build`, `Unit Tests`, `Integration Tests`.
- "Require branches to be up to date before merging": habilitado.
- Sin excepción de bypass para administradores.
- Pushes directos a `main` deshabilitados — todo cambio entra por Pull Request.

**Por qué el último punto no es opcional:** `wait-for-security-workflows.js` solo evalúa el riesgo cuando el commit pertenece a un PR **abierto** contra `main` (`findOpenPullRequestForSha`). Un push directo a `main` no tiene PR abierto asociado, así que `risk-assessment.yml` hace *no-op* (`proceed: false`) y nunca corre `Security Risk Gate` para ese commit. Si se permitieran pushes directos a `main`, ese código llegaría a producción sin haber pasado por el gate de seguridad.

## El Threat Model ya alimenta el gate (dejó de ser solo informativo)

`docs/threat-model/threagile.yml` se corre en cada PR (`threat-model.yml`, vía la imagen oficial de Threagile) y su `risks.json` se pasa a `risk-engine` como una cuarta fuente (`--threat-model`, junto a `--sast`/`--sca`/`--secrets`). Antes de este cambio, el reporte de Threagile era puramente informativo — ni siquiera estaba trackeado en git y ningún gate lo leía.

Reglas del nuevo parser (`risk-engine/src/parsers/threat-model/threagileRisksParser.ts`):

- Solo entran al gate los riesgos **todavía abiertos** en `risk_tracking` (`unchecked`, `in-discussion`, `in-progress`). Los que ya fueron triageados como `mitigated`, `accepted` o `false-positive` se filtran antes de llegar al engine — ya tienen su propio trail de accountability (`justification`/`checked_by`/`date`) y no deben re-litigarse en cada PR.
- Mapeo de severidad Threagile → risk-engine: `low→LOW, medium→MEDIUM, elevated→HIGH, high→HIGH, critical→CRITICAL` (decisión explícita: "elevated" se trata como HIGH, no como MEDIUM).

**Hallazgo al validar esto (no era un bug del parser, era un defecto de calibración preexistente en risk-engine) — ya corregido:** con `impact_mode: max` (el default original de `config/likelihood-impact-rules.yml`), los factores de *business impact* de `application.yml` (financial=8, privacy=8, compliance=8, reputation=9 — fijos para esta app) por sí solos alcanzaban HIGH y arrastraban **cualquier** finding a CRITICAL sin importar su severidad técnica real. Confirmado corriendo `analyze` contra `tests/fixtures/low-risk-finding.json` (deliberadamente LOW, preexistente): también daba CRITICAL. Esto no era específico del threat model — afectaba SAST/SCA/secrets por igual, solo que nadie lo había notado.

Se cambió `impact_mode` a `average` (modo ya soportado y testeado, solo no era el default; ver comentario en `likelihood-impact-rules.yml`). Con esto, el mismo fixture LOW pasa a MEDIUM/WARN, y de los 20 riesgos actuales del threat model, 11 (los de severidad LOW — en su mayoría ruido ya identificado como `false-positive`/`accepted` en el triage) pasan a MEDIUM/WARN en vez de CRITICAL/BLOCK. Los 9 restantes (8 medium + 1 elevated) siguen dando CRITICAL — **eso sigue siendo intencional** para esta app (production, internet-exposed, PCI, PII, financiero) y **sigue requiriendo el triage de `risk_tracking`** antes de mergear esto, no es opcional.

## Gap conocido: `deploy-ecr.yml` no re-verifica el gate

`deploy-ecr.yml` se dispara por `push` a `main` y hoy depende enteramente de que el branch protection descrito arriba haya hecho su trabajo — no vuelve a consultar el resultado de `Security Risk Gate` para el commit que va a construir y subir a ECR. La única evidencia de que ese despliegue pasó el gate de seguridad vive en la configuración de GitHub Settings, no en el propio pipeline de deploy.

Pendiente: agregar un job previo en `deploy-ecr.yml` que busque el PR asociado a `github.sha` (`GET /repos/:owner/:repo/commits/:sha/pulls`, funciona también con PRs ya mergeados) y confirme que el Check Run `Security Risk Gate` de su `head.sha` tiene `conclusion == "success"` antes de construir la imagen. Mientras esto no exista, `deploy-ecr.yml` es tan seguro como la configuración de branch protection, y nada más.
