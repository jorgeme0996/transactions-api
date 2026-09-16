# CI/CD Workflows

Este directorio contiene los workflows de GitHub Actions del proyecto. A continuación se describe cada uno: qué hace, cuándo se ejecuta y qué tipo de control de calidad/seguridad representa.

## Diagrama del pipeline

```
                         PULL REQUEST
                              │
             ┌────────────────┼────────────────┐
             │                │                │
             ▼                ▼                ▼
        Unit Tests      Integration       Security
                           Tests               │
                                              │
                    ┌───────────┬──────────────┬──────────────┐
                    │           │              │              │
                    ▼           ▼              ▼              ▼
                  SAST         SCA         Secrets       Threat Model
                 CodeQL   Dependency    Gitleaks/          Threagile
                            Review     Secret Scan
                    │           │              │              │
                    └───────────┴──────┬───────┴──────────────┘
                                        │
                                        ▼
                                       SECURITY GATE
                                              │
                                     ┌────────┴────────┐
                                     │                 │
                                    FAIL              PASS
                                     │                 │
                                     ▼                 ▼
                                BLOCK PR            MERGE
                                                       │
                                                       ▼
                                                     BUILD
                                                       │
                                                       ▼
                                                     IMAGE
                                                       │
                                                       ▼
                                                  Container Scan
                                                       │
                                                       ▼
                                                  PUSH A ECR
                                                       │
                                                       ▼
                                                DEPLOY (EKS/K8s)
```

> Los bloques de **Unit Tests**, **Integration Tests**, **SAST (CodeQL)**, **SCA (Dependency Review)**, **Secrets (Gitleaks)** y **Threat Model (Threagile)** corren hoy como workflows de este directorio y actúan como gate obligatorio antes del merge. **BUILD → IMAGE → Container Scan → PUSH A ECR** también existen ya (`deploy-ecr.yml`). Solo **DEPLOY (EKS/K8s)** sigue sin automatizar: no hay ningún workflow en este repositorio que aplique `k8s/*.yml` al cluster (se hace manualmente o vía un proceso externo no versionado acá).

## Resumen

| Workflow | Tipo | Trigger | Frecuencia |
|---|---|---|---|
| [build.yml](./build.yml) | Build | Pull Request → `main` | En cada PR |
| [unit-tests.yml](./unit-tests.yml) | Unit Testing | Pull Request → `main` | En cada PR |
| [integration-tests.yml](./integration-tests.yml) | Integration Testing | Pull Request → `main` | En cada PR |
| [codeql.yml](./codeql.yml) | SAST | Push/PR → `main` + programado | En cada push/PR y semanalmente (lunes 6am UTC) |
| [dependency-review.yml](./dependency-review.yml) | SCA | Pull Request → `main` | En cada PR |
| [secret-scanning.yml](./secret-scanning.yml) | Secret Scanning | Push/PR → `main` | En cada push/PR |
| [threat-model.yml](./threat-model.yml) | Threat Model (Threagile) | Pull Request → `main` | En cada PR |
| [risk-assessment.yml](./risk-assessment.yml) | Risk Gate + AI review | `workflow_run` (tras CodeQL, Secret Scanning, Dependency Review, Threat Model) | Al terminar los cuatro workflows anteriores para el mismo commit |
| [deploy-ecr.yml](./deploy-ecr.yml) | Build + Container Scan + Push | Push → `main` | En cada push a `main` |

---

## build.yml

- **Tipo:** Build
- **Qué hace:** Instala dependencias con Yarn y corre `yarn build` (`nest build`) para verificar que el proyecto compila (TypeScript → JavaScript) sin errores. Detecta errores de tipado o de compilación antes de que lleguen a `main`.
- **Cuándo corre:** En cada Pull Request dirigido a `main`.

## unit-tests.yml

- **Tipo:** Unit Testing
- **Qué hace:** Instala dependencias con Yarn y corre la suite de pruebas unitarias (`yarn test:cov`) con reporte de cobertura. Valida la lógica de negocio en aislamiento, sin dependencias externas (BD, servicios mock, etc.).
- **Cuándo corre:** En cada Pull Request dirigido a `main`.

## integration-tests.yml

- **Tipo:** Integration Testing
- **Qué hace:** Levanta un contenedor de PostgreSQL como servicio, corre las migraciones de la base de datos, inicia un servidor mock del proveedor externo y ejecuta la suite e2e (`yarn test:e2e`). Valida que los distintos componentes de la aplicación (API, BD, cliente HTTP externo) funcionen correctamente en conjunto.
- **Cuándo corre:** En cada Pull Request dirigido a `main`.

## codeql.yml

- **Tipo:** SAST (Static Application Security Testing)
- **Qué hace:** Analiza estáticamente el código fuente (JavaScript/TypeScript) usando CodeQL para detectar vulnerabilidades y patrones de código inseguro (inyección, XSS, manejo inseguro de datos, etc.). Los resultados se publican en la pestaña **Security** del repositorio.
- **Cuándo corre:** En cada push y Pull Request a `main`, y además de forma programada todos los lunes a las 6:00 UTC (para detectar vulnerabilidades nuevas en reglas de CodeQL aunque no haya cambios de código).

## dependency-review.yml

- **Tipo:** SCA (Software Composition Analysis)
- **Qué hace:** Compara las dependencias del branch base contra las del PR y reporta vulnerabilidades conocidas (CVEs) en las dependencias nuevas o modificadas. Bloquea el PR si se introduce una dependencia con severidad `high` o `critical`, y publica un comentario resumen en el PR.
- **Cuándo corre:** En cada Pull Request dirigido a `main`.

## secret-scanning.yml

- **Tipo:** Secret Scanning
- **Qué hace:** Usa [Gitleaks](https://github.com/gitleaks/gitleaks) para escanear el historial de commits y el diff del PR en busca de secretos filtrados (API keys, tokens, credenciales de base de datos, etc.). Falla el job y publica un resumen en el PR si detecta algún hallazgo.
- **Cuándo corre:** En cada Pull Request dirigido a `main` y en cada push a `main`.
- **Nota:** complementa (no reemplaza) el **Secret Scanning / Push Protection** nativo de GitHub, que se puede habilitar desde **Settings → Code security** del repositorio y actúa incluso antes del push.

## threat-model.yml

- **Tipo:** Threat Model (Threagile)
- **Qué hace:** Corre [Threagile](https://threagile.io/) (imagen oficial `threagile/threagile`, pineada por digest) contra `docs/threat-model/threagile.yml` y sube `risks.json` como artifact. Solo genera el JSON de riesgos (no el PDF/diagramas/excel) porque es lo único que consume `risk-engine`. Corre en **todo** PR, no solo en los que tocan el modelo -- `wait-for-security-workflows.js` exige un run completado de este workflow para cualquier `head_sha` antes de dejar avanzar el gate, así que restringirlo con `paths:` dejaría el gate trabado para el resto de los PRs.
- **Cuándo corre:** En cada Pull Request dirigido a `main`.

## risk-assessment.yml

- **Tipo:** Risk Gate + traducción a lenguaje humano
- **Qué hace:** Espera a que CodeQL, Dependency Review, Secret Scanning y Threat Model terminen para el mismo commit (`wait-for-security-workflows.js`), corre `risk-engine` sobre sus salidas (incluyendo los riesgos del threat model todavía no triageados en `risk_tracking`) y publica el comentario **🔐 Security Risk Assessment** + el Check Run **`Security Risk Gate`**. Ese comentario está pensado para alimentar la decisión PASS/WARN/BLOCK, no para lectura humana directa (usa severidades, IDs de regla, salida casi cruda).
- Al terminar (y solo si hubo hallazgos: `has_findings == 'true'`), el job `notify-cubic` (independiente de `security-gate`, corre incluso en BLOCK) le hace una pregunta directa a `@cubic-dev-ai` -- no un `review this PR` completo, para no apilar una revisión nueva encima de la automática en cada push -- pidiéndole **un solo comentario** consolidado que traduzca hasta los 5 hallazgos más importantes a lenguaje humano (riesgo real + cambio de código concreto). Solo se mantiene viva una de estas preguntas por PR: la de un commit anterior se borra antes de publicar la del commit nuevo. La regla persistente que le enseña a cubic a responder así (un solo comentario, corto, priorizado) vive en [cubic.yaml](../../cubic.yaml) (`reviews.custom_rules`), y solo aplica una vez mergeada a `main` (cubic lee su config del branch default).
- **Cuándo corre:** vía `workflow_run` al completarse CodeQL, Secret Scanning, Dependency Review o Threat Model; solo procede si las cuatro ya terminaron para el mismo `head_sha`.

## deploy-ecr.yml

- **Tipo:** Build + Container Scan + Push a ECR
- **Qué hace:** Construye la imagen Docker, la escanea con Trivy (`CRITICAL`/`HIGH`, bloquea el job -- y por lo tanto el push -- si encuentra algo sin excluir por `ignore-unfixed`) y sube los resultados a la pestaña Security antes de pushear a ECR con el tag `github.sha` y `latest`.
- **Cuándo corre:** En cada push a `main`.
- **Gap conocido:** no vuelve a verificar el Check Run `Security Risk Gate` para el commit que construye -- depende enteramente de que branch protection ya lo haya exigido en el merge. Detalle en [docs/infra/Readme.md](../../docs/infra/Readme.md).
