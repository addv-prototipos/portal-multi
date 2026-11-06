# opencode.md — Memoria operativa de opencode para Clarvo (portalFac)

> Este archivo es el espejo de `AGENTS.md` para opencode: cómo debe pensar,
> analizar, proponer, implementar, probar y desplegar en este repositorio.
> No sustituye a `AGENTS.md`, `CLAUDE.md`, `PROJECT_STATE.md` ni `cmem.md`;
> los resume y dice **cómo usarlos**. Si hay conflicto, gana en este orden:
> 1) instrucción explícita del usuario en la sesión actual,
> 2) `AGENTS.md`,
> 3) este archivo,
> 4) `CLAUDE.md`,
> 5) `PROJECT_STATE.md` / `cmem.md` como historia y evidencia.
>
> Idioma: **español de México (es-MX), siempre**, salvo que el usuario
> escriba primero en otro idioma. Cero emojis en código, documentos,
> correos, mockups o respuestas de producto.

---

## 0. Reglas no negociables (aprendidas del comportamiento real de Claude)

1. **Analizar antes de tocar nada.** Ningún archivo del proyecto se escribe
   sin haber leído primero el código real afectado. Prohibido asumir que
   algo "ya existe" o "sigue pendiente" por un commit message, un comentario
   viejo o la documentación: se verifica con `grep`/`Select-String` sobre el
   código actual. Casos reales que originaron esta regla: puntos 352, 369 y
   449 de `PROJECT_STATE.md`.
2. **No asumir requisitos ambiguos.** Si falta un dato de negocio, un
   nombre, un alcance o una decisión de producto, se pregunta antes de
   implementar. Si el bloqueo es técnico, primero se investigan y se
   proponen **al menos 3 alternativas** con ventajas/desventajas; solo se
   pregunta si ninguna es razonable sin decisión del usuario.
3. **Criticar y mejorar el requerimiento.** No se implementa literalmente
   lo pedido si existe una forma más simple, segura, accesible, mantenible
   o con menos deuda. Se presenta la opción original y la mejorada; el
   usuario decide.
4. **Confirmación explícita antes de implementar.** Presentar análisis,
   crítica, alternativas y propuesta visual es libre. Escribir archivos,
   ejecutar comandos que cambien estado, hacer commits o desplegar requiere
   instrucción explícita ("impleméntalo", "procede", "hazlo", "despliega").
   Una luz verde a un plan completo cubre sus pasos triviales; no cubre una
   decisión nueva no contemplada.
5. **Segmentos acotados y completos.** Cada bloque debe quedar funcional,
   probado y documentado antes de pasar al siguiente. No entregar mitades.
6. **Pruebas siempre: unitarias + funcional real.** Jest/supertest con BD
   mockeada es integración, no reemplaza la verificación funcional. En este
   proyecto "funcional" es Playwright/E2E real contra Docker+MySQL reales,
   o clics reales confirmados por el usuario. Para UI, además, propuesta
   visual antes/después con capturas reales.
7. **Cero datos sensibles en el frontend.** Claves, tokens, credenciales,
   PII y lógica de negocio crítica viven y se validan en backend. TLS
   siempre; hash+salt para contraseñas; cifrado en reposo cuando aplique.
8. **Documentar al cerrar.** `PROJECT_STATE.md` (punto nuevo, al final),
   `CLAUDE.md` (solo reglas persistentes nuevas), `AGENTS.md` (solo reglas
   persistentes nuevas), `cmem.md` (entrada nueva con fecha, nunca
   reescribir historial), `pendientes.html` cuando aplique y `README.md` si
   cambia instalación/operación.
9. **Commits solo si se piden.** No hacer `git add`, `commit`, `push` ni
   PR por iniciativa propia.
10. **Nunca copiar secretos al repo.** `.env*`, `admin-users.env`,
    `kerberos-users.env`, `VULTR/` y `hostinger/` están gitignored. Los
    secretos reales viven en `VULTR/prodDoc.html` y `/opt/clarvo/.env` del
    servidor; se referencian, nunca se transcriben a archivos versionados.

---

## 1. Protocolo addv-web-app (8 pasos, sin saltos)

Este repo opera bajo la skill `addv-web-app`. El flujo es:

1. **Analizar** — qué se pide, qué archivos/módulos se afectan, qué opciones hay.
2. **Revisar impacto** — qué puede romperse, qué depende de lo tocado, riesgo de seguridad/performance/UX/datos.
3. **Criticar y mejorar** — evaluar el requerimiento; proponer alternativa mejor si existe.
4. **Propuesta visual antes/después** — obligatoria para cualquier cambio de UI, con capturas reales (Playwright/msedge), no solo texto.
5. **Segmentar** — bloques funcionalmente completos y aprobables por separado.
6. **Confirmar** — esperar luz verde explícita del segmento elegido.
7. **Implementar** — solo el segmento aprobado, completo.
8. **Probar y asegurar** — unitarias + funcional real + revisión de secretos/cifrado + cero regresiones.

Piso de calidad no negociable: UX/UI, accesibilidad WCAG 2.1 AA, Core Web
Vitals, anti-hackeo (OWASP Top 10 aplicable), Docker/Docker Compose,
pruebas ejecutables en local y calidad nivel SonarQube.

---

## 2. Cómo trabaja Claude en este repositorio (comportamiento observado)

### 2.1 Fuentes de contexto que lee, en orden

1. `AGENTS.md` — master prompt operativo (reglas, stack, gotchas).
2. `CLAUDE.md` — contexto persistente y reglas de arquitectura.
3. `PROJECT_STATE.md` — fuente de verdad punto por punto (~481 puntos). Se
   busca por número (`## Punto NNN`) o palabra clave antes de reimplementar.
4. `cmem.md` — memoria comprimida estilo claude-mem, respaldo manual de las
   sesiones. Última entrada: retroceso/backfill y puntos recientes.
5. Claude Mem (`~/.claude-mem/claude-mem.db`, plugin `claude-mem@thedotmack`
   v13.13.1) — observaciones automáticas cross-sesión. En Claude Code se
   consulta por MCP (`search`, `timeline`, `get_observations`); en opencode
   no hay MCP de Claude Mem, así que se usa `cmem.md` + `PROJECT_STATE.md`
   y, si hace falta, lectura de solo lectura de la SQLite.
6. `pendientes.html` — ítems abiertos; su `localStorage`
   (`portalClarvo_pendientes_checks_v1`) solo lo puede leer el usuario
   ("Copiar estado"), nunca la automatización de navegador (`file://`).
7. `README.md` — instalación/operación y versionado.
8. `VULTR/README-VULTR.md`, `VULTR/prodDoc.html`, `VULTR/MAPA-LOGS.md` —
   runbook real de producción. `VULTR/` es gitignored y contiene secretos.

### 2.2 Cómo razona

- **Verifica contra código real antes de afirmar.** Ejemplo: antes de decir
  "el flag no existe", busca el nombre real (`marcaLookfeelHabilitado`, no
  `marca_propia`); antes de decir "la ruta no está gateada", cuenta
  `requiereFeature(`.
- **Distingue producto de herramientas de despliegue.** `hostinger/` y
  `VULTR/` nunca cuentan en métricas de calidad ni se analizan como producto.
- **Distingue flag de tenant vs. flag de sitio base.** Tenant:
  `control_tenants.tenants`. Sitio base: `configuracion_global` dentro de
  `configuracion` (`backend/utils/config.js`). `ajustes_globales` es solo
  para el máximo de imagen y ajustes de control.
- **Nunca comparte una ruta entre dos superficies con flags de gobierno
  distintos.** Si una ruta sirve a dos vistas, se crea una ruta dedicada
  (caso real: `POST /api/admin/reportes/corte`, punto 361).
- **Aplica 404, nunca 403, en candados de feature.** `requiereFeature()`
  siempre antes de `requireAdminAuth`/`requireUserAuth`.
- **Reutiliza el patrón existente** en vez de inventar uno nuevo. Antes de
  crear un componente, busca uno hermano y cópialo.
- **Prueba con datos reales.** Playwright con `channel: 'msedge'` (Chromium
  no está instalado), `playwright-core` fuera del repo, espera ~400 ms tras
  clics por transiciones. Para overlays asíncronos usa
  `page.addLocatorHandler`, no un `isVisible()` puntual.
- **Cuando el usuario reporta un bug de producción, primero reproduce y
  aísla la causa raíz**, no parchea el síntoma. Documenta el gotcha en
  `CLAUDE.md`/`AGENTS.md`.
- **Cierra con evidencia:** `node --check` en cada `.js` tocado, suites Jest
  (`backend`, `control`) sin regresiones, y verificación funcional real.

### 2.3 Lo que Claude NO hace

- No inventa nombres de columnas, rutas, flags ni precios. Verifica con
  `SHOW COLUMNS`, `grep` o el código.
- No despliega sin backup, sin `git archive HEAD` y sin smoke-test.
- No usa `tar` del working tree (otra sesión puede tener cambios sin
  commitear). Usa `git -c core.autocrlf=false archive HEAD`.
- No confía en un backup de 0 bytes ni en que `tar` "debió" funcionar:
  verifica `md5sum`.
- No hace `docker compose restart` esperando que relea `env_file`; usa
  `up -d --force-recreate`.
- No usa `Date.UTC`/`toISOString().slice(0,10)`/`CURDATE()` para ventanas
  "hoy/mes" del tenant; usa `backend/utils/limitesPeriodo.js`.
- No toca `hostinger/` ni `VULTR/` en análisis de calidad.
- No pone emojis ni caracteres Unicode tipo "●"/"✓" en UI; usa SVG
  feather-like o `<span>` circular.

---

## 3. Mapa del proyecto

```
portalFac/
├── backend/      Portal de cliente + panel /admin por tenant (Express 4, MySQL)
├── control/      App cross-tenant /control (contenedor propio, MySQL angosto)
├── frontend/     nginx + HTML/CSS/JS vanilla, sin build step
├── docker/       Garage (S3), init de MySQL, etc.
├── e2e/          Playwright real contra Docker+MySQL
├── calidad/      Informes tipo SonarQube (eval.html, sonar*.html)
├── kerberos/     App de monitoreo de infraestructura (/kerberos)
├── VULTR/        Runbook y secretos de producción real (gitignored)
├── hostinger/    Paquete del VPS de pruebas (gitignored)
├── DOCS/         Documentación auxiliar
├── AGENTS.md / CLAUDE.md / PROJECT_STATE.md / cmem.md / README.md
└── opencode.md   Este archivo
```

Tres services de aplicación, tres builds Docker separados. **Nunca copiar
código entre `backend/` y `control/`**: código pequeño compartido se duplica
a propósito.

Stack: Node.js 20 + Express 4, MySQL 8 (`mysql2/promise`, SQL crudo, sin ORM),
nginx estático, Docker Compose/Swarm. Contenedores `clrv-*` (proyecto
`clarvo-app`).

---

## 4. Comandos frecuentes

```powershell
# Levantar stack local
docker compose up -d --build

# Health
curl http://localhost/api/health

# Pruebas
cd backend; npm test
cd control; npm test
npx jest test/integration

# Regresión contra MySQL real (desde el HOST, no dentro del contenedor)
node backend/scripts/verificar-mysql.js

# Sintaxis
node --check backend/ruta/al/archivo.js
```

Gotcha: `backend/scripts/verificar-mysql.js` NO está dentro de la imagen
(`.dockerignore` excluye `scripts/`). Requiere `DB_*` y `MINIO_*` de `.env`.

---

## 5. Gotchas operativos que más se repiten

Leer la sección completa en `AGENTS.md` → "Gotchas operativos recurrentes".
Los de mayor impacto:

1. **Bind-mount de archivo inexistente crea un directorio fantasma.**
   Montar siempre el directorio contenedor, nunca el archivo suelto (punto 479).
2. **`docker compose restart` no relee `env_file`/`.env`.** Usar
   `up -d --force-recreate`.
3. **Rebuild que no se refleja:** `docker compose build --no-cache <svc>` +
   `up -d --force-recreate <svc>`.
4. **Tras recrear `backend`, nginx puede cachear la IP vieja.** Reiniciar
   `frontend` después.
5. **`ensureSchema()` corre en cada restart; solo aplica al pool base.**
   Las bases `tenant_*` ya aprovisionadas no se migran solas: reinvocar
   `/internal/activar-tenant/:slug` con `X-Internal-Secret` es paso de deploy.
6. **nginx intercepta 502/503/504 como mantenimiento.** Un error de API
   debe responder 500.
7. **CSP:** declarar `img-src 'self' data: blob:` y `frame-src 'self' blob:`
   si se usan blob/data URLs.
8. **Whitelist de extensiones estáticas en nginx:** cualquier extensión
   nueva no listada cae al 404 anti-enumeración.
9. **Fechas "hoy/mes":** usar `backend/utils/limitesPeriodo.js`
   (`instantes.*` para DATETIME, `fechas.*` para DATE).
10. **Contraste WCAG:** no quitar el `#` antes de medir luminancia.
11. **`showToast()` antes de cerrar el modal** lo oculta; cerrar primero,
    notificar después.
12. **Delegación por `classList.contains` exacto** se rompe si el elemento
    gana hijos; usar `.closest('.campo-ayuda')`.
13. **`.algo[hidden]{display:none}` explícito** en cualquier clase nueva con
    `display` distinto de `none`.
14. **Tarjetas de Configuraciones:** 3 registros obligatorios
    (`CONFIG_SECCIONES`, `GRUPOS_CONFIG_NAV`, `tarjetasConfigPermitidas`).
15. **Vistas del sidebar:** 3 registros (`mapaNavPorVista`,
    `GRUPOS_SIDEBAR_NAV`, `vistasPermitidas`).
16. **`control_tenants.tenants` no tiene `actualizado_en` genérico.** Usar
    solo timestamps específicos (`plan_actualizado_en`, etc.).
17. **`control_app` no tiene `DELETE` ni `REFERENCES`.** "Eliminar" es
    soft-delete (`eliminado_en`) o bloqueo con 409.
18. **Stripe:** los planes nunca viven como Product/Price en el catálogo;
    se arma `price_data` inline. `invoice.subscription` ya no existe; leer
    `invoice.parent.subscription_details.subscription` con fallback.
19. **Webhooks de Stripe son por modo (test/live).** Auto-sanado en
    `control/utils/stripeWebhookHealth.js`; smoke-test obligatorio al
    cambiar de modo.
20. **`usuarios.email` es único solo para `perfil='cliente'`.** Toda query
    de cliente por email lleva `AND perfil='cliente'`.

---

## 6. Producción real: Vultr (clarvo.mx)

> Fuente de verdad: `VULTR/README-VULTR.md` (procedimiento) y
> `VULTR/prodDoc.html` (accesos y secretos, gitignored). Este resumen no
> reproduce secretos.

### 6.1 Arquitectura

- VPS `clarvo-prod-01`, Vultr Atlanta, Ubuntu 22.04, 4 vCPU/16 GB.
- Docker Swarm de 1 nodo (manager único, label `mysql-role=primary`).
- Servicios Swarm: `mysql-primary`, `mysql-control`, `garage` +
  `garage-init`, `backend`, `control`, `frontend` (publicado en
  `127.0.0.1:8088`, `mode: host`).
- `clarvo-Site` corre aparte con `docker compose` (puerto `127.0.0.1:8090`).
- nginx del HOST (con certbot) enruta `clarvo.mx` entre 8088 y 8090.
- Datos persistentes en `/mnt/blockstorage`.

### 6.2 Conexión (gotcha crítico)

Usar **OpenSSH nativo de Windows**, nunca el de Git Bash:

```powershell
& "C:\Windows\System32\OpenSSH\ssh.exe" -i "C:\Users\Antonio\.ssh\id_ed25519" root@64.177.56.96
```

El SSH de Git Bash tiene un bug de firma con
`publickey-hostbound@openssh.com`. Mismo binario para `scp`.

### 6.3 Runbook de despliegue (obligatorio, en orden)

1. **Backup real** de `mysql-primary` y `mysql-control` antes de tocar
   código. Subir `backup.sh` por `scp` evita el infierno de comillas.
   Dentro de CADA contenedor MySQL la variable se llama
   `MYSQL_ROOT_PASSWORD` (no `MYSQL_CONTROL_ROOT_PASSWORD`). Verificar que
   ambos `.sql` pesen > 0 bytes; un backup de 0 bytes se ve exitoso.
2. **Empaquetar solo lo commiteado**, nunca el working tree:

   ```powershell
   git -c core.autocrlf=false archive HEAD -- backend control frontend docker |
     gzip > VULTR/src.tar.gz
   & "C:\Windows\System32\OpenSSH\scp.exe" -i "C:\Users\Antonio\.ssh\id_ed25519" `
     VULTR/src.tar.gz root@64.177.56.96:/root/
   ```

   `core.autocrlf=false` es obligatorio en Windows: sin esto `git archive`
   convierte LF→CRLF y todos los `md5sum` de verificación salen "distintos".
3. **Reemplazar carpetas completas** en `/opt/clarvo/` (nunca dejar
   huérfanos de una sesión anterior):

   ```bash
   ssh root@64.177.56.96 "rm -rf /opt/clarvo/backend /opt/clarvo/control /opt/clarvo/frontend /opt/clarvo/docker && tar xzf /root/src.tar.gz -C /opt/clarvo && rm /root/src.tar.gz"
   ```

4. **Verificar `md5sum`** de varios archivos realmente tocados contra
   `git show HEAD:<ruta> | md5sum` local. Deben coincidir exacto. Si no
   coinciden pero el contenido se ve bien, sospechar line-endings antes de
   asumir corrupción.
5. **Reconstruir imágenes** y forzar recreate. Si `docker-stack.yml` no
   cambió, no hace falta redeploy del stack:

   ```bash
   cd /opt/clarvo
   docker build -t clrv-backend:latest ./backend
   docker build -t clrv-control:latest ./control
   docker build -t clrv-frontend:latest ./frontend
   docker service update --force clarvo_backend
   docker service update --force clarvo_control
   docker service update --force clarvo_frontend
   ```

   Reiniciar `frontend` una segunda vez si se recreó `backend` (IP cacheada).
   Si cambió `docker-stack.yml` o `.env`:

   ```bash
   cd /opt/clarvo && set -a && source .env && set +a && docker stack deploy -c docker-stack.yml clarvo
   ```

6. **Smoke-test obligatorio** tras cualquier deploy que toque
   backend/control/frontend:

   ```powershell
   node VULTR/smoke-test-onboarding.js --borrar
   ```

   Hace un alta real desde `https://clarvo.mx`, Checkout real de Stripe
   (modo prueba), confirma que el webhook activa el tenant solo, y lo borra.
   Requiere `playwright-core` fuera del repo y Edge (`channel: 'msedge'`).
   **Si falla, el deploy no se da por bueno.**

7. **Limpieza de contenedores huérfanos** tras `service update --force`:

   ```bash
   ssh root@64.177.56.96 "/opt/clarvo/scripts/limpieza-docker.sh"
   ```

8. **Actualizar `VULTR/prodDoc.html`** después de CADA despliegue/cambio en
   producción (instrucción explícita del usuario). Nunca omitir.

9. **Registrar el despliegue** en `PROJECT_STATE.md` (punto nuevo) y en
   `cmem.md`, con evidencia real (versión, `curl` 200, `md5sum`, smoke-test).

### 6.4 clarvo-Site (repo separado)

`D:\srv\clarvo-Site`, repo `addv-sites/clarvo-tempSite`, stack Docker Compose
aparte. Se despliega con el mismo criterio: `git archive HEAD`, `scp`,
extraer **sobre** `/opt/clarvo-site/` (sin `rm -rf`, el `.env` vive ahí),
`./actualizar.sh`. Las variables `PUBLIC_*` de Astro se hornean en build;
cambiar el `.env` no basta, hay que rebuild.

### 6.5 Logs

- App: `docker service logs clarvo_backend|control|frontend --tail 200`.
- nginx HOST: `/var/log/nginx/access.log` y rotaciones (fuente real de
  tráfico; `zgrep` para históricos).
- nginx contenedor: solo reenvío interno.
- MySQL: logs de contenedor; slow query deshabilitado por default.
- Auditoría de negocio: `admin_auditoria`, `tenant_eventos`,
  `stripe_eventos_procesados`, `onboarding_borradores`,
  `ajustes_globales` (`stripe_webhook_*`).
- Mapa completo: `VULTR/MAPA-LOGS.md`.

---

## 7. Inventario de configuración y skills

### 7.1 Configuración de Claude Code en este repo

- `.claude/settings.json`: modelo `claude-sonnet-5`, `claudeFlow` v3,
  agent teams, swarm mesh/max 5, memoria en RAM, statusline.
- `.claude/settings.local.json`: allowlist extensa de comandos, MCP `idea`
  habilitado, `claude-flow` deshabilitado.
- `.mcp.json`: `claude-flow` (npx ruflo), `idea` (HTTP local),
  `chrome-devtools`.
- `.codex/config.toml`: variables de Claude Flow + MCP `idea`.
- `.claude/helpers/`: statusline, hooks, memoria, router.
- Claude Mem: plugin `claude-mem@thedotmack` v13.13.1, datos en
  `C:\Users\Antonio\.claude-mem\` (`claude-mem.db`, `chroma/`).
- Hooks globales: caveman (activación + tracker), task-observer.
- Skills globales Claude: `C:\Users\Antonio\.claude\skills\` (incluye
  `addv-web-app`).
- Skills de proyecto: `.agents/skills/` y `.claude/skills/` (33 skills de
  `addyosmani/agent-skills` + ruflo; symlinks/copias, gitignored vía
  `.agents/` y `.claude/`).

### 7.2 Skills de proyecto (33, todas con `SKILL.md`)

`api-and-interface-design`, `browser-testing-with-devtools`,
`ci-cd-and-automation`, `code-review-and-quality`, `code-simplification`,
`constraint-driven-development`, `context-engineering`,
`debugging-and-error-recovery`, `deprecation-and-migration`,
`documentation-and-adrs`, `doubt-driven-development`,
`frontend-ui-engineering`, `git-workflow-and-versioning`,
`hooks-automation`, `idea-refine`, `incremental-implementation`,
`interview-me`, `observability-and-instrumentation`, `pair-programming`,
`performance-optimization`, `planning-and-task-breakdown`,
`security-and-hardening`, `shipping-and-launch`, `skill-builder`,
`source-driven-development`, `sparc-methodology`, `spec-driven-development`,
`stream-chain`, `swarm-advanced`, `swarm-orchestration`,
`test-driven-development`, `using-agent-skills`, `verification-quality`.

### 7.3 Skills globales relevantes para el protocolo

Diseño/UX: `design-critique`, `design-handoff`, `design-system`,
`research-synthesis`, `user-research`, `ux-copy`, `frontend-design`,
`frontend-design-direction`, `accessibility-review`.
Backend/infra: `api-integration-consumption`,
`backend-robustness-architecture`, `docker-containerization`.
Checklist final: `web-performance-accessibility`, `low-impact-motion`.
Eficiencia: `agent-skills`, `caveman`, `graphify`, `claude-mem`,
`superpowers`, `impeccable`, `find-skill`, `task-observer`, `ruflo`,
`prompt-master`, `ui-ux-pro-max`.
Motores de razonamiento: `brainstorming`, `systematic-debugging`,
`test-driven-development`, `verification-before-completion`,
`writing-plans`, `executing-plans`, `subagent-driven-development`,
`dispatching-parallel-agents`.

> Antes de decir que una skill no existe: revisar el catálogo de skills
> activas, luego `D:\cc`, luego el repositorio oficial. Nunca inventar su
> función.

### 7.4 Configuración de opencode (lo que crea este cambio)

- `opencode.jsonc` en la raíz: `instructions: ["opencode.md"]`,
  `default_agent: "addv-orchestrator"`, permisos y MCP.
- `.opencode/agent/`:
  - `addv-orchestrator.md` (primary) — protocolo, crítica, segmentos,
    coordinación de subagentes.
  - `claude-memory.md` (subagent) — lee `cmem.md`/`PROJECT_STATE.md`/Claude
    Mem y mantiene `opencode.md`.
  - `vultr-operator.md` (subagent) — runbook Vultr, backups, smoke-test.
  - `skills-sync.md` (subagent) — audita skills/config y actualiza
    `D:\srv\addv-web-app`.
  - `project-auditor.md` (subagent) — mapeo y análisis read-only.
  - `docs-keeper.md` (subagent) — actualiza documentación al cerrar.
- `.opencode/command/`: `addv.md` (invoca el protocolo) y
  `plan-parallel.md` (genera plan de olas).
- Después de guardar configuración/agentes: **reiniciar opencode**; la
  sesión en curso no recarga config.

---

## 8. Claude Mem: cómo leerlo desde opencode

Claude Code expone Claude Mem por MCP (`mem-search`). opencode no tiene ese
MCP, pero la base existe en:

```
C:\Users\Antonio\.claude-mem\claude-mem.db
C:\Users\Antonio\.claude-mem\chroma\chroma.sqlite3
```

Reglas:
1. **Nunca modificar** esos archivos; solo lectura.
2. Si `sqlite3` no está disponible, no inventar: usar `cmem.md` y
   `PROJECT_STATE.md` como fuente.
3. No copiar PII/secretos de la memoria a archivos versionados.
4. El flujo recomendado de Claude Mem es: `search` → `timeline` →
   `get_observations` (filtrar antes de traer detalle). Si en opencode no
   hay MCP, replicar ese orden leyendo primero índices/títulos y luego
   detalle puntual.

---

## 9. Plan de ejecución en paralelo (olas)

Objetivo: aprender el proyecto, actualizar la skill ADDV y dejar opencode
configurado sin bloquearse entre tareas. Cada ola tiene dependencias
explícitas; no se solapan agentes que escriben el mismo archivo.

### Ola 0 — Inventario base (paralelo, solo lectura)

| Agente | Tarea | Salida |
|---|---|---|
| `claude-memory` | Leer `AGENTS.md`, `CLAUDE.md`, `PROJECT_STATE.md` (índice de puntos), `cmem.md` y `VULTR/*` | Resumen de reglas, decisiones y gotchas |
| `project-auditor` | Mapear módulos, rutas, tests y scripts de despliegue | Mapa con `archivo:línea` |
| `skills-sync` | Inventariar skills/config Claude+opencode+MCP | Tabla de estado real (instalada/configurada/funcionando) |
| `vultr-operator` | Leer runbook y producir checklist de deploy | Checklist sin ejecutar SSH |

**Criterio de cierre:** los 4 reportes existen y no se contradicen; si hay
contradicción, gana el código real y se anota en `opencode.md`.

### Ola 1 — Síntesis (paralelo, escritura acotada)

| Agente | Tarea | Archivos permitidos |
|---|---|---|
| `claude-memory` | Redactar/refrescar `opencode.md` | `opencode.md` |
| `skills-sync` | Actualizar `D:\srv\addv-web-app` + copias globales | `D:\srv\addv-web-app\**`, `~/.claude/skills/addv-web-app/**`, `~/.agents/skills/addv-web-app/**` |
| `vultr-operator` | Validar que el runbook documentado coincide con `README-VULTR.md`/`prodDoc.html` | solo lectura + reporte |

**Criterio de cierre:** `opencode.md` sin secretos, skill con frontmatter
válido (`name` + `description`), y las 3 copias con el mismo contenido.

### Ola 2 — Documentación del cambio (serial, tras Ola 1)

| Agente | Tarea |
|---|---|
| `docs-keeper` | Añadir punto nuevo a `PROJECT_STATE.md`, entrada a `cmem.md`, nota persistente a `AGENTS.md`/`CLAUDE.md` si aplica, ítem a `pendientes.html` |

**Criterio de cierre:** documentación actualizada y `git diff` solo con
archivos esperados.

### Ola 3 — Operación real (solo bajo pedido explícito)

`vultr-operator` ejecuta el runbook de la sección 6 **solo** cuando el
usuario diga "despliega a producción". No se ejecuta en paralelo con otra
ola de escritura. Requiere backup verificado, `git archive HEAD`,
`md5sum`, rebuild, smoke-test y actualización de `prodDoc.html`.

### Ola 4 — Verificación final

`addv-orchestrator` verifica:
- `node --check` en `.js` tocados.
- `npm test` en `backend`/`control` (si aplica).
- Que no haya secretos en archivos versionados.
- Que `opencode.md` y la skill describan la misma configuración.
- Que el plan de olas siga siendo válido.

---

## 10. Checklist antes de cerrar cualquier trabajo

- [ ] Leí el código real afectado, no solo la documentación.
- [ ] Identifiqué impacto y riesgos; propuse mejora si existía.
- [ ] Mostré antes/después visual si toqué UI.
- [ ] Esperé confirmación explícita del segmento.
- [ ] Implementé solo lo aprobado, completo.
- [ ] `node --check` limpio en todos los `.js` tocados.
- [ ] Suites Jest sin regresiones (o regresiones preexistentes explicadas).
- [ ] Verificación funcional real (Playwright/msedge o clics del usuario).
- [ ] Revisé secretos: nada sensible en frontend/repo; TLS/cifrado correctos.
- [ ] Actualicé `PROJECT_STATE.md`, `cmem.md` y, si aplica, `CLAUDE.md`,
      `AGENTS.md`, `README.md`, `pendientes.html`.
- [ ] Si desplegué: backup > 0 bytes, `md5sum` exacto, smoke-test verde,
      `prodDoc.html` actualizado.

---

## 11. Fuentes de este archivo

- `AGENTS.md` (master prompt operativo).
- `CLAUDE.md` (reglas persistentes y gotchas).
- `PROJECT_STATE.md` (puntos 1–481; en especial 352, 369, 400, 442, 460,
  464, 465, 472–481).
- `cmem.md` (memoria comprimida de sesiones).
- `VULTR/README-VULTR.md`, `VULTR/prodDoc.html`, `VULTR/MAPA-LOGS.md`,
  `VULTR/smoke-test-onboarding.js`.
- `D:\srv\addv-web-app\SKILL.md` (protocolo ADDV).
- Configuración real: `.claude/settings*.json`, `.mcp.json`, `.codex/config.toml`,
  `.claude/helpers/`, `~/.claude/plugins/installed_plugins.json`,
  `skills-lock.json`, `.agents/skills/`, `.claude/skills/`.

> Mantener este archivo actualizado al cerrar cambios de arquitectura,
> operación, configuración de agentes o skills. No es un historial de
> features: para eso existe `PROJECT_STATE.md`.
