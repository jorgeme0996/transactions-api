# Contribuir a Transacciones API

Reglas de código limpio y seguro para este proyecto, derivadas del [threat model](docs/threat-model/threagile.yml) y de los riesgos identificados en `docs/threat-model/report/`. El objetivo no es seguir buenas prácticas genéricas, sino cerrar los riesgos concretos que ya conocemos para esta API (maneja transacciones y credenciales `strictly-confidential`).

## 1. Acceso a datos (TypeORM / Postgres)

- **Prohibido SQL crudo con interpolación de strings.** Usar siempre `Repository`/`QueryBuilder` con parámetros (`.where('x = :val', { val })`), nunca template strings con variables dentro de `.query()`.
- `queryRunner.query()` con SQL crudo solo se permite en migraciones con DDL fijo (sin variables de usuario), como ya está hecho en `src/config/migrations/`.
- En code review: un PR que agregue una query con `${}` dentro de un string SQL se rechaza, salvo que sea 100% literal.

## 2. Validación de entrada

- Todo DTO expuesto por un controller debe tener decoradores de `class-validator` (ver `TransactionRequestDTO`/`TransactionsQueryDTO` como referencia).
- Usar `ValidationPipe` con `whitelist: true` y `forbidNonWhitelisted: true` para que ningún campo extra llegue al `Repository` o a `ProviderService`.

## 3. Llamadas salientes / SSRF

- La URL de `payment-provider` (o de cualquier servicio externo futuro) sale siempre de `ConfigService`/variables de entorno, **nunca** de un campo del body/query del cliente.
- Si se agrega algo como una "callback URL" configurable por el cliente, requiere una allowlist explícita de hosts antes de mergear.

## 4. Secretos

- Nada de credenciales hardcodeadas ni defaults inseguros en código (evitar patrones como `password: 'postgres'` de fallback silencioso).
- `.env` nunca se commitea. En producción, los secretos vienen de un vault/secrets manager (AWS Secrets Manager, Doppler, HashiCorp Vault, etc.), no de variables planas en el contenedor.
- Comparación de API keys siempre con `timingSafeEqual` (ver `ApiKeyGuard`), nunca `===` para secretos.

## 5. Transporte

- Cualquier conexión a Postgres fuera de una red privada de confianza debe forzar `ssl: true` / `sslmode=require` en el `DataSource`.
- HTTPS de punta a punta en producción; nunca HTTP plano entre servicios que crucen redes no confiables.

## 6. Hardening de la API

- `helmet()` y rate limiting (`@nestjs/throttler`) son obligatorios en `main.ts` antes de cualquier release a producción.
- CORS explícito (allowlist de orígenes), nunca `*`.
- Rate limit más agresivo específicamente en `POST /transactions`, ya que dispara un pago real contra `payment-provider`.

## 7. Manejo de errores y logs

- No filtrar detalles internos en las respuestas de error. Revisar cualquier passthrough directo de la respuesta de un proveedor externo hacia el cliente.
- Loggear errores (ej. Datadog) sin volcar el body completo de una transacción (`amount`, `accountId`) en texto plano sin redacción — `transaction-data` es `confidential` según el threat model.

## 8. Threat model

- Todo cambio de arquitectura (nuevo endpoint, nueva integración externa, nuevo flujo de datos) debe reflejarse en `docs/threat-model/threagile.yml` **antes** de mergear. Usar el skill `update-threat-model` para esto.
- Los riesgos marcados como falso positivo o aceptados deben llevar justificación escrita en el yml, no solo un cambio de `risk_status` sin explicación.

## 9. Autenticación y autorización de endpoints

- `ApiKeyGuard` se aplica globalmente vía `APP_GUARD`. Cualquier ruta nueva debe pasar por este guard; marcarla `@Public()` requiere justificación explícita en el PR (hoy solo `GET /` y `/healthcheck` son públicas, ver `api-consumer` → `transacciones-api` en el threat model).
- El modelo de autorización actual es `authorization: none`: el `API_KEY` es compartido y `GET /transactions` no filtra por `accountId` ni pagina resultados, por lo que cualquier tenedor del `API_KEY` puede leer transacciones de todas las cuentas. No asumir aislamiento por cuenta/tenant en código nuevo.
- Si se introduce autorización por cuenta/tenant o identidad de usuario final (cerrando el riesgo `missing-identity-propagation`), actualizar `docs/threat-model/threagile.yml` (campo `authorization` y la comunicación `to-transacciones-api`) además de este documento.

## Stack y flujo general

- NestJS + TypeScript, `yarn` como package manager.
- Tests: `yarn test`, `yarn test:e2e`. Lint: `npx eslint`. Build: `yarn build`.
- Respetar Prettier (`.prettierrc`) y los hooks de husky en pre-commit.
- No editar `dist/` (generado por el build).
