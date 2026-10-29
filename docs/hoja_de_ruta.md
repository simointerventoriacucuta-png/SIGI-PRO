# SIGI Pro: hoja de ruta (a partir de los manuales de OPUS M1R, M2, M3 y M4)

Las notas completas de cada manual están en la carpeta temporal de la sesión, en `manuales\notas_M3.txt` y `manuales\notas_M4.txt`.

## Ya hecho (v0.1)

- Proyecto con dos contratos:
  - Obra (vigilado): AIU con IVA sobre la utilidad.
  - Interventoría (propio): estampillas e IVA sobre el total.
- Presupuesto en árbol de capítulos e ítems, con edición en celda, pegado desde Excel y exportación.
- Actas parciales y cuentas de cobro: contratada, anterior, presentada, aprobada, acumulada, saldo y %. Las mayores cantidades se marcan en rojo.
- Balance del contrato y mayores y menores cantidades.
- Gastos reales y control de costos del contrato propio: presupuestado, gastado, facturado y margen.
- Vencimientos, pólizas, personal, correspondencia, bitácora, ensayos y memoria-grafo.

## Siguiente, por prioridad

1. **Sincronización entre computadores.** Base en la nube con copia local (Turso/libSQL) o Google Drive.
2. ✅ **Usuarios, roles y auditoría** (hecho) (M3, M4, M2 cap. 5):
   - Roles: director, residente, especialistas, administrativo y entidad (solo consulta).
   - Matriz de permisos vista × operación.
   - Bitácora de quién cambió qué.
   - Un documento aprobado queda bloqueado.
3. ✅ **Estados con barra de pasos** (hecho) (M3) para actas y solicitudes del contratista:
   - Borrador → Radicada → En revisión → Con observaciones → Aprobada interventoría → Avalada entidad → Pagada.
4. ✅ **Otrosíes y modificaciones** (hecho: valor y plazo vigentes con historial y aviso de pólizas; faltan ítems no previstos con APU y cantidades por otrosí) (M2 9.1):
   - Adición de valor y prórroga, con historial versionado del valor y del plazo.
   - Ítems no previstos con APU.
   - Cantidad contratada vigente = original + otrosíes.
   - Aviso de que las pólizas deben ajustarse.
5. **Anticipo, retenciones y pagos** (M2 9.5 y 9.8):
   - Amortización del anticipo por acta.
   - Retención de garantía, ReteFuente, ReteICA y estampillas.
   - Registro de pagos de la entidad con saldo por pagar.
6. **Programa de obra y curva S** (M2 7.6 y 10.7):
   - Programado por periodo como línea base, con versiones por otrosí y suspensión.
   - Programado vs. ejecutado, SPI y semáforos.
7. **Tramos y abscisas** (frentes de M2): avance por tramo, memorias de cálculo por abscisa (ancho × largo × espesor) y fotos.
8. **Formatos oficiales e informe mensual** (M1R):
   - Plantillas de Excel o Word con campos de la base.
   - Valores en letras en pesos.
   - Explorador de reportes.
9. **Listas de chequeo documental** (M4) para el acta de inicio, cada acta de pago y la liquidación, con adjunto y estado por requisito.
10. **Comparativo de precios no previstos** (M3 y M4): APU frente a referencias, con mínimo, máximo y promedio.
11. **Suspensiones y reinicios** con recálculo del plazo; **liquidación** con balance final y devolución de retenciones.
12. Aportes de M1:
    - **Memoria de cantidades por ítem y acta:** abscisa inicial y final, costado, largo, ancho, espesor y piezas, o una fórmula; con fotos y estado medida → verificada → aprobada.
    - **Importador de Excel** que deja escoger el rango y asignar columnas, y reconoce capítulos.
    - **Adjuntos por registro** en actas, mediciones, ensayos, pólizas y oficios.
    - Valor en letras en las actas.
    - Semáforo de aprobación por fila.
13. **Integraciones con otras aplicaciones** (pedido del usuario):
    - Exportar e importar con Excel (.xlsx), Word (actas e informes desde plantillas) y Microsoft Project (programa de obra y avance).
    - Autodesk (AutoCAD, Civil 3D, InfraWorks, Revit): leer alineamientos y abscisas para seguir el avance sobre el plano, por tramo e ítem.
    - Tableros tipo Power BI: publicar los datos (actas, avance, costos) para gráficos, y el asistente con Claude para analizarlos.
14. ✅ **Correo (Gmail)** (hecho): lectura periódica por IMAP con contraseña de aplicación; cada correo crea correspondencia con adjuntos, sin duplicados; la IA (Gemini) sugiere resumen, plazo y vencimientos que el usuario confirma.
15. Vistas con filtro, búsqueda resaltada y agrupación (M3) y exportación a Excel de cualquier vista.

## Lo que no se copia de OPUS

Bodega, requisiciones, recursos perseguidos, explosión de insumos, programa de suministros, precios de contratista, tipos de contrato internos y CPI de costo real.
