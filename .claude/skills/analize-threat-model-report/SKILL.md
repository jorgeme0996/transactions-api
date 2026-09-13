---
name: analize-threat-model-report
description: Explica en lenguaje claro los riesgos del reporte de threat model generado por threagile y propone acciones para cada uno, sin modificar código ni el modelo
---

Este skill es de solo lectura/análisis. No debe editar código, `threagile.yml`, ni ningún archivo bajo `docs/threat-model/`.

1. Lee `docs/threat-model/report/risks.json` (lista de riesgos con `category`, `severity`,
   `exploitation_likelihood`, `exploitation_impact`, `title`, `most_relevant_technical_asset`,
   `risk_status`, `data_breach_probability`).
2. Si existe, lee también `docs/threat-model/report/stats.json` para dar un resumen por severidad
   (critical/elevated/high/medium/low) y por estado (unchecked/in-progress/mitigated/accepted/false-positive).
3. Lee `docs/threat-model/threagile.yml` para entender qué activo técnico o flujo de datos
   corresponde a cada `most_relevant_technical_asset` / `most_relevant_communication_link`
   mencionado en los riesgos, y así explicar el riesgo con el contexto real del sistema
   (no solo repetir el texto genérico de threagile).
4. Para cada riesgo (o agrupado por categoría si hay varios similares), explica:
   - Qué significa en términos simples (no jargon de threagile).
   - Por qué aplica a este componente/flujo específico del proyecto.
   - Severidad y probabilidad de explotación, traducidas a impacto de negocio real.
5. Propón una acción concreta por riesgo o categoría: mitigar (con la remediación específica),
   aceptar el riesgo (y por qué sería razonable), marcar como falso positivo (y por qué), o
   investigar más. Sé específico al proyecto (NestJS, postgres, etc.), no genérico.
6. Prioriza la salida: primero los riesgos de mayor severidad/probabilidad, luego el resto.
7. No apliques ninguna de las remediaciones propuestas ni cambies `risk_status` en los JSON/yml.
   Solo presenta el análisis y las recomendaciones para que el usuario decida.
