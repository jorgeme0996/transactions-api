---
name: sync-contributing-threat-model
description: Detecta cambios en docs/threat-model/ desde la última actualización de docs/CONTRIBUTING.md y propone ediciones a CONTRIBUTING.md para que las reglas que usa el bot de revisión sigan reflejando el threat model vigente
---

1. Lee el contenido actual de `docs/CONTRIBUTING.md` junto con `docs/threat-model/threagile.yml` y `docs/threat-model/report/risks.json` tal como están en el working tree.
2. Compáralos semánticamente: verifica que cada activo, flujo, integración externa y riesgo del threat model tenga una regla correspondiente en CONTRIBUTING.md.
3. Si todo el threat model ya está cubierto, informa que CONTRIBUTING.md ya está sincronizado y termina.
4. Si falta cobertura, identifica qué (nuevos activos, nuevos flujos, nuevas integraciones externas, riesgos nuevos o con `risk_status` cambiado) y qué regla de CONTRIBUTING.md le correspondería a cada uno, o si falta una regla nueva.
5. Propón las ediciones concretas a `docs/CONTRIBUTING.md` (sección, texto a agregar/cambiar) como diff, sin aplicarlas automáticamente al archivo.
6. Solo edita `docs/CONTRIBUTING.md` si el usuario confirma explícitamente la propuesta.
