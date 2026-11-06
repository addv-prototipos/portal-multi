---
description: Genera un plan de ejecución en olas paralelas para una tarea
agent: addv-orchestrator
---

Diseña un plan de ejecución en olas paralelas para:

$ARGUMENTS

Reglas:

- Ningún archivo se escribe por dos agentes a la vez.
- Ola de lectura primero (`project-auditor`, `claude-memory`, `skills-sync`,
  `vultr-operator` en modo lectura).
- Ola de síntesis después, con archivos permitidos explícitos por agente.
- Ola de documentación al final (`docs-keeper`).
- Operación real (`vultr-operator`) solo con pedido explícito de despliegue
  y nunca en paralelo con otra ola de escritura.

Devuelve una tabla con: ola, agente, tarea, archivos permitidos, dependencia
y criterio de cierre. No ejecutes nada todavía.
