# Arquitectura (Modelo C4)

### Nivel 1 — Diagrama de Contexto

Muestra el sistema en relación con los usuarios y sistemas externos con los que interactúa.

```mermaid
C4Context
  title Diagrama de Contexto - Transacciones API

  System_Ext(consumerApi, "Consumidor API", "Sistema que integra pagos y consulta transacciones")
  System(transaccionesApi, "Transacciones API", "Expone endpoints REST para crear y consultar transacciones")
  System_Ext(provider, "Proveedor de pagos", "Servicio externo que autoriza y ejecuta la transacción financiera")
  SystemDb_Ext(db, "PostgreSQL", "Almacena el historial de transacciones")

  Rel(consumerApi, transaccionesApi, "Crea y consulta transacciones", "HTTPS/JSON, header x-api-key")
  Rel(transaccionesApi, provider, "Ejecuta la transacción", "HTTPS/JSON, header x-api-key")
  Rel(transaccionesApi, db, "Lee y escribe transacciones", "SQL vía TypeORM")
```

### Nivel 2 — Diagrama de Contenedores

Desglosa el sistema "Transacciones API" en sus piezas desplegables.

```mermaid
C4Container
  title Diagrama de Contenedores - Transacciones API

  Person(client, "Cliente/Consumidor API")

  System_Boundary(c1, "Transacciones API") {
    Container(api, "API NestJS", "Node.js, NestJS", "Expone /transactions (POST, GET), valida API key y orquesta la lógica de negocio")
    ContainerDb(db, "Base de datos", "PostgreSQL", "Persiste las transacciones (tabla transactions)")
  }

  System_Ext(provider, "Proveedor de pagos", "Autoriza/ejecuta la transacción (mockeado en dev con json-server)")

  Rel(client, api, "POST/GET /transactions", "HTTPS, x-api-key")
  Rel(api, db, "Lee/escribe transacciones", "TypeORM")
  Rel(api, provider, "POST /provider/v1/execute", "HTTPS, x-api-key")
```

### Nivel 3 — Diagrama de Componentes (contenedor "API NestJS")

```mermaid
C4Component
  title Diagrama de Componentes - API NestJS

  Container_Boundary(api, "API NestJS") {
    Component(guard, "ApiKeyGuard", "Guard global (APP_GUARD)", "Valida el header x-api-key en cada request; permite rutas marcadas @Public()")
    Component(controller, "TransactionsController", "Controller", "Expone POST y GET /transactions")
    Component(service, "TransactionService", "Service", "Valida reglas de negocio, ejecuta la transacción y persiste el resultado")
    Component(providerSvc, "ProviderService", "Service", "Llama al proveedor de pagos vía HTTP")
    Component(repo, "TransactionRepository", "TypeORM Repository", "CRUD sobre la entidad Transaction")
  }

  ContainerDb_Ext(db, "PostgreSQL")
  System_Ext(provider, "Proveedor de pagos")

  Rel(guard, controller, "Protege el acceso a")
  Rel(controller, service, "Delega en")
  Rel(service, providerSvc, "Ejecuta transacción vía")
  Rel(service, repo, "Guarda/consulta vía")
  Rel(providerSvc, provider, "HTTP POST /provider/v1/execute")
  Rel(repo, db, "SQL")
```
