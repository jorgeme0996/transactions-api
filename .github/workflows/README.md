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
                                  ┌───────────┼───────────┐
                                  │           │           │
                                  ▼           ▼           ▼
                                SAST         SCA      Secrets
                               CodeQL   Dependency   Gitleaks/
                                          Review     Secret Scan
                                  │           │           │
                                  └───────────┼───────────┘
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
                                                    DEPLOY
```

> Los bloques de **Unit Tests**, **Integration Tests**, **SAST (CodeQL)**, **SCA (Dependency Review)** y **Secrets (Gitleaks)** corren hoy como workflows de este directorio y actúan como gate obligatorio antes del merge. Los bloques posteriores al merge (**BUILD → IMAGE → Container Scan → DEPLOY**) representan el flujo objetivo de CI/CD; todavía no existen como workflows en este repositorio.

## Resumen

| Workflow | Tipo | Trigger | Frecuencia |
|---|---|---|---|
| [build.yml](./build.yml) | Build | Pull Request → `main` | En cada PR |
| [unit-tests.yml](./unit-tests.yml) | Unit Testing | Pull Request → `main` | En cada PR |
| [integration-tests.yml](./integration-tests.yml) | Integration Testing | Pull Request → `main` | En cada PR |
| [codeql.yml](./codeql.yml) | SAST | Push/PR → `main` + programado | En cada push/PR y semanalmente (lunes 6am UTC) |
| [dependency-review.yml](./dependency-review.yml) | SCA | Pull Request → `main` | En cada PR |
| [secret-scanning.yml](./secret-scanning.yml) | Secret Scanning | Push/PR → `main` | En cada push/PR |

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
