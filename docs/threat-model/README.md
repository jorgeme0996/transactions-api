# Threat Model (Threagile)

`threagile.yml` es el modelo formal de la arquitectura de seguridad: `technical_assets`,
`data_assets`, `communication_links` y `trust_boundaries`. Se ejecuta automáticamente en
cada PR (`.github/workflows/threat-model.yml`) y sus riesgos **todavía abiertos**
alimentan el Check Run `Security Risk Gate` junto con SAST/SCA/secrets — ver
[docs/infra/Readme.md](../infra/Readme.md) para el detalle de esa conexión y del fix de
calibración que la acompañó.

Esto es intencionalmente un proceso **humano**, no automático: ni un script ni un LLM
pueden triagear su propio hallazgo de seguridad. Esta guía es para dos casos:

1. Vas a hacer un cambio de arquitectura y necesitás actualizar el modelo.
2. Un riesgo del reporte necesita una decisión (mitigar / aceptar / marcar falso positivo).

## 1. Si vas a hacer un cambio de arquitectura

Un "cambio de arquitectura" es: un endpoint nuevo, una integración externa nueva, un
tipo de dato nuevo que la API empieza a manejar, o un flujo que cruza una frontera de
confianza que antes no cruzaba.

1. **Actualizar `threagile.yml` en el mismo PR que el cambio de código** (no después):
   - Servicio/endpoint nuevo → nuevo `technical_asset`, con su `communication_links` si
     habla con otro asset existente.
   - Dato nuevo que la API empieza a manejar → nuevo `data_asset`, con
     `confidentiality`/`integrity`/`availability` honestos (no copiar los de otro asset
     por comodidad).
   - Podés usar el skill `update-threat-model` (Claude Code) para que proponga el diff
     del modelo a partir del código nuevo, en vez de escribirlo a mano desde cero.
2. **Regenerar el reporte localmente** para ver qué riesgos nuevos aparece antes de
   siquiera abrir el PR (comando verificado contra el binario real — requiere haber
   corrido `scripts/setup-threagile.sh` una vez):

   ```bash
   ~/go/bin/threagile \
     -model docs/threat-model/threagile.yml \
     -output docs/threat-model/report \
     -generate-risks-json=true \
     -generate-report-pdf=false \
     -generate-risks-excel=false \
     -generate-tags-excel=false \
     -generate-data-asset-diagram=false \
     -generate-data-flow-diagram=false \
     -generate-technical-assets-json=false \
     -generate-stats-json=false
   ```

   (En CI corre la imagen oficial de Docker con los mismos flags — ver
   `.github/workflows/threat-model.yml`.)
3. Abrir `docs/threat-model/report/risks.json` y revisar los riesgos nuevos. Cualquiera
   de severidad `medium` o superior que vaya a entrar al PR necesita, antes de mergear:
   - un fix real en el código/infra, **o**
   - un triage explícito en `risk_tracking` (sección 2) con justificación real.
4. Abrir/actualizar el PR normalmente. `threat-model.yml` corre solo y sus riesgos
   siguen abiertos entran al `Security Risk Gate` — si algo quedó `unchecked` en
   severidad medium+, el PR probablemente se bloquee.

## 2. Cómo triagear un riesgo (`risk_tracking`)

En `docs/threat-model/threagile.yml`, agregar o editar el bloque `risk_tracking:` a
nivel raíz (mismo nivel que `data_assets`/`technical_assets`):

```yaml
risk_tracking:
  <synthetic_id-exacto>:
    status: false-positive # ver tabla abajo
    justification: >
      Explicación técnica concreta de por qué este status es correcto para
      este riesgo puntual -- nunca una frase genérica tipo "no aplica".
    checked_by: tu-email@dominio.com
    date: "2026-09-16"
    ticket: '' # opcional: referencia a Jira/Linear si el trabajo sigue pendiente
```

El `<synthetic_id-exacto>` sale de `docs/threat-model/report/risks.json`, campo
`synthetic_id` (ej. `sql-nosql-injection@transacciones-api@postgres-db@transacciones-api>to-db`).
Copiarlo literal — es sensible a cualquier rename en el modelo; si cambiás el nombre de
un asset, el id cambia y ese tracking queda huérfano (Threagile lo loguea, no falla,
pero hay que volver a triagearlo con el id nuevo).

| `status` | Cuándo usarlo | ¿Cuenta como abierto para el gate? |
|---|---|---|
| `unchecked` | Default — nadie lo miró todavía. | Sí |
| `in-discussion` | Se está evaluando, sin decisión aún. | Sí |
| `in-progress` | Ya se decidió arreglarlo, hay trabajo en curso. | Sí |
| `mitigated` | Ya se corrigió en código/infra. | No |
| `accepted` | Riesgo real, decisión consciente de no arreglarlo ahora. Requiere justificación real. | No |
| `false-positive` | La heurística de Threagile no aplica a este caso concreto. | No |

("¿Cuenta como abierto?" = si el parser de `risk-engine`
(`threagileRisksParser.ts`) lo deja pasar al `Security Risk Gate` o lo filtra.)

Ejemplo real ya aplicado en este repo:

```yaml
risk_tracking:
  sql-nosql-injection@transacciones-api@postgres-db@transacciones-api>to-db:
    status: false-positive
    justification: >
      Todo acceso a postgres-db pasa por TypeORM Repository API (create/find con
      FindOptionsWhere tipado, Between() sobre DTOs validados); sin SQL crudo ni
      createQueryBuilder con strings en src/.
    checked_by: jorge@goldmediatech.com
    date: '2026-09-16'
```

Después de editar `threagile.yml`, regenerar el reporte (paso 2 de la sección anterior)
y confirmar en `risks.json` que el riesgo ya no figura como `unchecked` antes de
abrir/actualizar el PR — la CI lo va a regenerar de nuevo de todos modos, pero verificarlo
localmente ahorra una vuelta de PR roja.

## Qué NO es esto

`risk_tracking` (acá) y `risk-engine/config/exceptions.yml` son **dos sistemas
distintos** que no se leen entre sí:

| | `risk_tracking` (acá) | `risk-engine/config/exceptions.yml` |
|---|---|---|
| Triagea | Los riesgos de `docs/threat-model/report/risks.json` | Hallazgos de CodeQL/SCA/gitleaks |
| Se identifica por | `synthetic_id` | `finding_id` |
| Campos requeridos | `status`, `justification`, `checked_by`, `date` | `reason`, `approved_by`, `expires_at` |

Si necesitás aceptar un hallazgo de CodeQL/SCA/secrets, es en `exceptions.yml`, no acá.
