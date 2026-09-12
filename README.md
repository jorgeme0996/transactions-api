# Transacciones API

API REST construida con [NestJS](https://nestjs.com/) para crear y consultar transacciones financieras (débitos/créditos). Cada transacción se ejecuta contra un proveedor de pagos externo y, una vez resuelta, se persiste en PostgreSQL.

## Stack técnico

- **Runtime/Framework:** Node.js + NestJS 11
- **Base de datos:** PostgreSQL vía TypeORM
- **HTTP client:** `@nestjs/axios` para comunicarse con el proveedor de pagos
- **Autenticación:** API Key (`x-api-key`) validada en un guard global
- **Proveedor de pagos (dev):** mock local con `json-server` (`mock/server.js`)

## Arquitectura (Modelo C4)

Ver el detalle completo con los tres niveles (Contexto, Contenedores, Componentes) en [docs/arquitectura](docs/arquitectura/README.md).

## Componentes principales

| Componente | Ubicación | Responsabilidad |
|---|---|---|
| `ApiKeyGuard` | [src/auth/api-key.guard.ts](src/auth/api-key.guard.ts) | Guard global que exige `x-api-key` válido en cada request (salvo rutas `@Public()`) |
| `TransactionsController` | [src/transactions/transactions.controller.ts](src/transactions/transactions.controller.ts) | Endpoints `POST /transactions` y `GET /transactions` |
| `TransactionService` | [src/transactions/transactions.service.ts](src/transactions/transactions.service.ts) | Valida reglas de negocio, invoca al proveedor y persiste la transacción |
| `ProviderService` | [src/provider/provider.service.ts](src/provider/provider.service.ts) | Cliente HTTP hacia el proveedor de pagos externo |
| `Transaction` (entity) | [src/transactions/transaction.entity.ts](src/transactions/transaction.entity.ts) | Entidad TypeORM mapeada a la tabla `transactions` |

## Puesta en marcha

```bash
yarn install
yarn start:dev
```

Variables de entorno requeridas (ver [.env.example](.env.example)):

- `API_KEY`: clave que deben enviar los clientes en `x-api-key`
- `PROVIDER_URL` / `PROVIDER_API_KEY`: credenciales del proveedor de pagos
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`: conexión a PostgreSQL

Para desarrollo local, `yarn mock` levanta un proveedor de pagos simulado ([mock/server.js](mock/server.js)) en `http://localhost:3001`.

## Modelado de amenazas (Threagile)

El modelo de amenazas del sistema está definido en [docs/threat-model/threagile.yml](docs/threat-model/threagile.yml) y se ejecuta con [Threagile](https://threagile.io/), instalado de forma nativa (no vía Docker: la imagen oficial solo publica `linux/amd64` y falla al emularse en Mac con Apple Silicon).

Instalación (una sola vez, requiere Homebrew):

```bash
./scripts/setup-threagile.sh
```

El script instala Go y Graphviz si faltan, instala threagile vía `go install`, y compila localmente el plugin de cálculo RAA y aplica el fix necesario para macOS (ver comentarios en el script para el detalle de por qué es necesario). Deja todo en `~/.threagile` y `~/go/bin/threagile`; agrega a tu shell:

```bash
export PATH="$HOME/.threagile:$HOME/go/bin:$PATH"
```

Para generar el reporte:

```bash
mkdir -p docs/threat-model/report
threagile -verbose -model docs/threat-model/threagile.yml -output docs/threat-model/report \
  -raa-plugin "$HOME/.threagile/raa.so" -background "$HOME/.threagile/background.pdf"
```

El reporte (PDF, diagramas de flujo de datos y riesgos identificados) se genera dentro de `docs/threat-model/report`.
