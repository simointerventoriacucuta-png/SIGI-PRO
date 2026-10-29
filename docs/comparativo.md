# SIGI Pro frente a otros programas y a lo que piden las entidades

Fecha: octubre de 2026. La matriz usa la información pública de cada proveedor y de directorios de software, y no viene de pruebas propias de esos programas. Antes de citarla ante un cliente hay que confirmar los módulos con cada proveedor.

## 1. Con qué se compara

| Programa | Tipo | Enfoque |
|---|---|---|
| **OPUS** (Ecosoft, México) | Escritorio | Presupuesto con APU, programa de obra, estimaciones (actas) y control de costos con la base ECOSTOS. Es la referencia de los manuales M1 a M4 de la hoja de ruta. |
| **Neodata** (México) | Escritorio | Precios unitarios y control de obra. Más barato que OPUS. |
| **Presto** (RIB, España) | Escritorio y nube | Gestión de costos, mediciones y certificaciones. Orientado a licitaciones europeas. |
| **SINCO ERP** (Colombia) | ERP web | Construcción, inmobiliario, infraestructura y concesiones viales. Contabilidad, compras, nómina y obra. |
| **Procore** | Nube y móvil | Plataforma completa: RFI, *submittals*, bitácora diaria, planos, presupuesto y calidad. |
| **Autodesk Construction Cloud / Forma** | Nube y móvil | Planos y modelos BIM, RFI, *submittals*, bitácoras e incidencias. Se integra con Civil 3D. |
| **Fieldwire** (Hilti) | Móvil | Tareas en campo sobre el plano, listas de chequeo, bitácora y *punch lists*. |
| **SECOP II** (Colombia Compra Eficiente) | Portal oficial | Expediente contractual electrónico. El supervisor o interventor debe mantenerlo al día. |

## 2. Matriz comparativa

Leyenda: ● completo · ◐ parcial · ○ no tiene · ? sin información pública.

| Función | SIGI Pro | OPUS | Neodata | Presto | SINCO | Procore | ACC | Fieldwire |
|---|---|---|---|---|---|---|---|---|
| Presupuesto por capítulos con AIU e IVA colombianos | ● | ◐ (AIU sí, IVA mexicano) | ◐ | ◐ | ● | ◐ | ◐ | ○ |
| APU y base de insumos | ○ | ● | ● | ● | ● | ○ | ○ | ○ |
| Actas parciales (presentado / aprobado / acumulado) | ● | ● | ● | ● | ● | ◐ (*pay apps*) | ◐ | ○ |
| Estados del acta y bloqueo al aprobar | ● | ◐ | ? | ◐ | ● | ● | ● | ○ |
| Otrosíes: adición y prórroga | ● | ◐ | ◐ | ◐ | ● | ● (*change orders*) | ● | ○ |
| Ítems no previstos con APU | ○ | ● | ● | ● | ● | ◐ | ◐ | ○ |
| Anticipo, amortización y retenciones | ○ | ● | ● | ● | ● | ◐ | ◐ | ○ |
| Contrato propio de interventoría (costos y margen) | ● | ○ | ○ | ◐ | ● | ○ | ○ | ○ |
| Programa de obra y curva S | ◐ | ● | ● | ● | ● | ● | ● | ◐ |
| Bitácora diaria, ensayos y correspondencia | ● | ○ | ○ | ○ | ◐ | ● | ● | ● |
| Fotos y avance en campo desde el celular | ◐ | ○ | ○ | ◐ | ◐ | ● | ● | ● |
| Avance sobre plano o alineamiento (abscisas) | ◐ | ○ | ○ | ○ | ○ | ● (planos) | ● (BIM) | ● (planos) |
| RFI, consultas y solicitudes con plazo de respuesta | ○ | ○ | ○ | ○ | ◐ | ● | ● | ● |
| **Lista de chequeo documental por acta** | ● (nuevo) | ○ | ○ | ○ | ◐ | ● | ● | ● |
| Control del expediente en SECOP II | ◐ (referencia por requisito) | ○ | ○ | ○ | ? | ○ | ○ | ○ |
| Usuarios, roles y auditoría | ● | ◐ | ◐ | ● | ● | ● | ● | ● |
| Trabajo sin internet y sincronización | ● (libSQL / Turso) | ● (local) | ● (local) | ● | ○ | ◐ | ◐ | ● |
| Tableros y asistente de IA | ◐ | ○ | ○ | ◐ | ◐ | ● | ● | ◐ |

## 3. Qué piden las entidades y cómo queda SIGI Pro

- **Colombia Compra Eficiente.** La [Guía para el ejercicio de las funciones de supervisión e interventoría](https://www.colombiacompra.gov.co/archivos/manual/guia-para-el-ejercicio-de-las-funciones-de-supervision-e-interventoria-de-los-contratos-suscritos-por-las-entidades-estatales) pide seguimiento técnico, administrativo, financiero, contable y jurídico. En SECOP II, el interventor debe mantener el expediente al día ([procedimiento de la Agencia Atenea](https://agenciaatenea.gov.co/sites/default/files/2025-04/P10_C%20Procedimiento%20de%20Supervisio%CC%81n%20e%20Interventoria%20V2.pdf)). SIGI Pro todavía no tiene un registro propio de lo publicado en SECOP II. Por ahora, cada requisito de la lista de chequeo guarda el radicado o el enlace de SECOP II.
- **INVÍAS.** No conseguí el texto vigente del Manual de interventoría; hay que descargarlo de invias.gov.co. Los fallos judiciales sobre contratos del INVÍAS muestran que una entidad devuelve el acta cuando no trae la documentación completa ([ejemplo en la Rama Judicial](https://www.ramajudicial.gov.co/documents/2216525/28096842/75120150011301.PDF/8fd00d49-3706-4eee-9f9e-f324ef3b4bfe)). También muestran que el acta de recibo definitivo es requisito para pagar la última acta ([otro caso](https://ramajudicial.gov.co/documents/7819331/33288414/11001-33-43-060-2020-00020-00+EJ+MAB+INCON+-+Inv%C3%ADas.pdf/072bbd42-0163-4e40-a729-dc948155e6ea)). Por eso conviene una lista de chequeo antes de aprobar cada acta.
- **Ley 1474 de 2011, art. 83 a 85, y Ley 789 de 2002, art. 50.** El interventor responde por el seguimiento. Antes de cada pago debe verificar los aportes a seguridad social, que ya están en la lista por defecto.
- **ANI.** Sus contratos de concesión piden informes periódicos y control de las obligaciones en matrices. Hace falta revisar sus apéndices técnicos para adaptar las plantillas a concesiones (pendiente).

## 4. Lo que falta o está flojo, por prioridad

Esfuerzo: S = menos de un día · M = 2 a 5 días · L = más de una semana.

| # | Mejora | Por qué importa | Esfuerzo |
|---|---|---|---|
| 1 | ✅ **Lista de chequeo documental del acta**, que impide aprobarla si faltan requisitos obligatorios (hecha en esta rama) | Evita que la entidad devuelva actas incompletas (hoja de ruta, punto 9) | S |
| 2 | Listas de chequeo para el acta de inicio y la liquidación, con plantillas que el director pueda editar | Completa el punto 9 | S |
| 3 | Adjuntar el archivo de soporte a cada requisito, además de la referencia | Hoy solo se guardan el radicado o el enlace | S–M |
| 4 | Registro del expediente en SECOP II: documento, fecha de publicación, plazo legal y alerta si está vencido | Obligación del interventor, y ningún programa comparado la tiene | M |
| 5 | Anticipo, amortización y retenciones por acta | Los tienen OPUS, Neodata, Presto y SINCO | M |
| 6 | Ítems no previstos con APU y comparativo de precios | Es el punto débil frente a OPUS y Neodata | L |
| 7 | Consultas y solicitudes del contratista (tipo RFI), con plazo de respuesta y semáforo | Es la función central de Procore, ACC y Fieldwire | M |
| 8 | Formatos oficiales de INVÍAS y ANI en Word y Excel, con valor en letras | Las entidades exigen sus propios formatos | M |
| 9 | App de campo sin conexión para el celular | Es la fortaleza de Fieldwire y Procore | L |
| 10 | Matriz de obligaciones contractuales, para el seguimiento jurídico que pide CCE | La guía de CCE pide seguimiento jurídico, además del técnico y el financiero | M |

## 5. Mejora implementada: la lista de chequeo documental del acta

- La primera vez que se abre un acta, SIGI Pro crea su lista de requisitos: hay una para las actas de obra y otra para las cuentas de interventoría. Los requisitos por defecto son el oficio de radicación, las memorias, las fotos, los ensayos, la seguridad social, las pólizas, SST y ambiental, la factura, el anticipo y las retenciones, y la publicación en SECOP II.
- Cada requisito tiene un estado (Pendiente, Cumple, No cumple o No aplica), una casilla de obligatorio, el radicado, folio o enlace de SECOP II y una observación. Se pueden agregar y quitar requisitos.
- **El acta no pasa a "Aprobada interventoría" mientras haya requisitos obligatorios que no estén en "Cumple" o "No aplica".** Cuando el acta se aprueba, la lista también queda bloqueada.
- API: `GET/POST /api/acta/:id/chequeo` y `PUT/DELETE /api/acta/:id/chequeo/:rid`. Usa el permiso de `acta` y registra cada cambio en la auditoría.

## Fuentes

- [Guía de supervisión e interventoría, Colombia Compra Eficiente](https://www.colombiacompra.gov.co/archivos/manual/guia-para-el-ejercicio-de-las-funciones-de-supervision-e-interventoria-de-los-contratos-suscritos-por-las-entidades-estatales) · [Tema supervisión e interventoría, CCE](https://www.colombiacompra.gov.co/archivos/tema/supervision-e-interventoria)
- [Guía de Función Pública para supervisores e interventores](https://www.funcionpublica.gov.co/eva/red/publicaciones/consulte-la-guia-para-el-ejercicio-de-las-funciones-de-supervisor-o-interventor)
- [Procedimiento de supervisión e interventoría, Agencia Atenea (SECOP II)](https://agenciaatenea.gov.co/sites/default/files/2025-04/P10_C%20Procedimiento%20de%20Supervisio%CC%81n%20e%20Interventoria%20V2.pdf)
- [Guía de supervisión e interventoría, Parques Nacionales (2024)](https://www.parquesnacionales.gov.co/wp-content/uploads/2024/10/A5-GU-01-GUIA-Supervision-e-Interventoria.pdf)
- Casos del INVÍAS: [Rama Judicial 1](https://www.ramajudicial.gov.co/documents/2216525/28096842/75120150011301.PDF/8fd00d49-3706-4eee-9f9e-f324ef3b4bfe) · [Rama Judicial 2](https://ramajudicial.gov.co/documents/7819331/33288414/11001-33-43-060-2020-00020-00+EJ+MAB+INCON+-+Inv%C3%ADas.pdf/072bbd42-0163-4e40-a729-dc948155e6ea)
- [Comparativo de software de presupuestos 2026 (OPUS, Neodata, Presto)](https://oneestimate.ai/es/blog/software-presupuestos-construccion-comparativa) · [Implementación de OPUS, UPB](https://repository.upb.edu.co/items/daa7d877-5f89-4024-a6db-8785141471de/full) · [Directorio de software de construcción](https://www.comparasoftware.com/construccion)
- [SINCO ERP en GetApp](https://www.getapp.ca/software/2073649/sinco-erp)
- [Fieldwire, Procore y Autodesk Forma (antes ACC) en G2](https://www.g2.com/compare/fieldwire-by-hilti-vs-procore-vs-autodesk-forma-formerly-autodesk-construction-cloud) · [Procore frente a Fieldwire](https://downtobid.com/blog/procore-vs-fieldwire) · [Procore frente a ACC](https://www.rfp.wiki/specialty-industries/construction-engineering/autodesk-construction-cloud/procore)
