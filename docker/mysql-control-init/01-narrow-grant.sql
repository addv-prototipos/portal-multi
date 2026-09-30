-- Punto 305 (Fase 1): el bootstrap estándar de la imagen mysql:8.0 le da a
-- MYSQL_USER (control_app) privilegios ALL PRIVILEGES sobre MYSQL_DATABASE
-- (control_tenants) por defecto -- este script corre justo después (solo
-- en el primer arranque, con el volumen vacío) y lo recorta al mismo grant
-- angosto que control_app ya usaba en la instancia MySQL compartida (ver
-- backend/scripts/lib/controlDb.js): sin DELETE ni DROP, para que un bug
-- en el código de /control nunca borre filas o tablas físicamente (mismo
-- espíritu que el soft-delete usado en el resto del proyecto).
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'control_app'@'%';
GRANT SELECT, INSERT, UPDATE, CREATE, ALTER ON control_tenants.* TO 'control_app'@'%';
FLUSH PRIVILEGES;
