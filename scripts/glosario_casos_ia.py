"""Glosario de los casos de uso de IA: original en ingles -> titulo canonico.

Nacio como glosario de traduccion, frase a frase. Al cerrar el catalogo en 100 casos
paso a ser otra cosa: el mapa del **nombre original en ingles al unico titulo con el
que ese caso se llama en toda la herramienta**. Por eso varias claves apuntan ahora al
mismo valor: describian el mismo caso con palabras distintas, y esa era precisamente
la duplicidad que habia que resolver.

Vive aparte de `traducir_casos_ia.py` para que la revision del glosario —que es donde
esta la decision de terminologia y lo unico que un consultor necesita auditar— no haya
que hacerla entre medias de la logica de reescritura del zip.

Criterio: se traduce lo que tiene equivalente asentado en espanol y se dejan intactas
solo las siglas del sector (DSO, KYC, RFP, SoW, M&A, P2P/O2C, 10Q/10K, MD&A) y los
nombres de producto (FinanceAI Insights Platform, Digital Analyst, GenAI).

Los casos retirados del catalogo no figuran aqui: su nombre ya no aparece en ningun
Excel, y dejarlos invitaria a volver a meterlos.

Generado a partir de la lista cerrada de 100 casos. Si se anade un caso nuevo, hay que
anadir tambien su clave inglesa: si no, `traducir_casos_ia.py` abortara al encontrarse
un titulo que no conoce.
"""

GLOSARIO = {
    # --- Checklist inteligente de cierre (IA-001) ---
    'Automated closing checklists': 'Checklist inteligente de cierre',
    'automated closing checklists': 'Checklist inteligente de cierre',
    # --- Cierre sin intervención sobre P2P y O2C (IA-002) ---
    'Capture variations and exceptions in P2P/O2C enabling touchless close':
        'Cierre sin intervención sobre P2P y O2C',
    'touchless close': 'Cierre sin intervención sobre P2P y O2C',
    # --- Minería de procesos del cierre (IA-003) ---
    'AI-enabled process mining': 'Minería de procesos del cierre',
    # --- Detección de provisiones omitidas (IA-004) ---
    'Identify missing monthly accruals': 'Detección de provisiones omitidas',
    'Identify missing monthly accruals based on historic trends':
        'Detección de provisiones omitidas',
    # --- Automatización de asientos y previsión del cierre (IA-005) ---
    'Journal Entry Automation & Close Value prediction':
        'Automatización de asientos y previsión del cierre',
    # --- Detección de asientos inusuales en el cierre (IA-006) ---
    'Identify unusual entries during close period': 'Detección de asientos inusuales en el cierre',
    'Identify unusual entries recorded during the close period':
        'Detección de asientos inusuales en el cierre',
    'anomaly detection during close': 'Detección de asientos inusuales en el cierre',
    'identify unusual entries during close': 'Detección de asientos inusuales en el cierre',
    # --- Vigilancia en tiempo real de asientos sospechosos (IA-007) ---
    'Monitor potentially suspect or fraudulent journal entries in real time':
        'Vigilancia en tiempo real de asientos sospechosos',
    'monitor suspect journal entries in real time':
        'Vigilancia en tiempo real de asientos sospechosos',
    'suspect journal entry monitoring': 'Vigilancia en tiempo real de asientos sospechosos',
    # --- Detección de errores de clasificación de gasto (IA-008) ---
    'Identify expense classification errors': 'Detección de errores de clasificación de gasto',
    'identify expense classification errors': 'Detección de errores de clasificación de gasto',
    # --- Detección proactiva de fraude (IA-009) ---
    'Proactive detection of fraudulent activities': 'Detección proactiva de fraude',
    # --- Conciliación a nivel de transacción (IA-010) ---
    'AI reconciliation': 'Conciliación a nivel de transacción',
    'AI-enabled reconciliation': 'Conciliación a nivel de transacción',
    'Reconcile account balances at transaction level': 'Conciliación a nivel de transacción',
    'Reconcile account balances at transaction level to invoices, purchase orders and bank statements':
        'Conciliación a nivel de transacción',
    # --- Consolidación multinorma y multidivisa (IA-015) ---
    'Consolidate accounting records under different standards and currencies':
        'Consolidación multinorma y multidivisa',
    # --- Detección de inconsistencias en datos maestros (IA-016) ---
    'Identify inconsistencies in master data': 'Detección de inconsistencias en datos maestros',
    'Identify inconsistencies in master data records':
        'Detección de inconsistencias en datos maestros',
    'identify inconsistencies in master data': 'Detección de inconsistencias en datos maestros',
    'identify inconsistencies in master data records':
        'Detección de inconsistencias en datos maestros',
    # --- Flujos guiados de cambio en datos maestros (IA-017) ---
    'Guided adaptable workflows for master data record changes':
        'Flujos guiados de cambio en datos maestros',
    'guided workflows for master data record changes':
        'Flujos guiados de cambio en datos maestros',
    # --- Generación de documentación de metadatos (IA-018) ---
    'Generate metadata documentation': 'Generación de documentación de metadatos',
    'generate metadata documentation': 'Generación de documentación de metadatos',
    # --- Integración automatizada de datos financieros (IA-019) ---
    'Automate financial data across diverse sources':
        'Integración automatizada de datos financieros',
    'automate financial data across diverse sources':
        'Integración automatizada de datos financieros',
    # --- Preparación asistida de estados financieros (IA-025) ---
    'Automated financial statement preparation': 'Preparación asistida de estados financieros',
    # --- Consolidación de informes en un único documento (IA-026) ---
    'Consolidate written financial reports': 'Consolidación de informes en un único documento',
    'Consolidate written financial reports into one compliant report':
        'Consolidación de informes en un único documento',
    'automated report consolidation': 'Consolidación de informes en un único documento',
    'consolidate written financial reports into one compliant report':
        'Consolidación de informes en un único documento',
    # --- Borrador de informes regulatorios (IA-027) ---
    'Generate draft regulatory filings': 'Borrador de informes regulatorios',
    # --- Borrador de secciones 10Q y 10K (IA-028) ---
    'Draft sections of 10Q / 10K generation': 'Borrador de secciones 10Q y 10K',
    'draft sections of 10Q/10K': 'Borrador de secciones 10Q y 10K',
    # --- Borrador narrativo del MD&A (IA-029) ---
    'Narrative MD&A draft generation': 'Borrador narrativo del MD&A',
    # --- Interpretación de normativa financiera (IA-030) ---
    'Financial rules and regulations interpretations': 'Interpretación de normativa financiera',
    'Financial rules interpretations': 'Interpretación de normativa financiera',
    'financial rules and regulations interpretations': 'Interpretación de normativa financiera',
    # --- Vigilancia de regulación emergente (IA-031) ---
    'Monitor emerging regulations and evaluate current state compliance':
        'Vigilancia de regulación emergente',
    # --- Seguimiento de políticas y regulación global (IA-032) ---
    'Global policy tracking': 'Seguimiento de políticas y regulación global',
    # --- Resumen de documentos legislativos (IA-033) ---
    'Summarizing legislative documents': 'Resumen de documentos legislativos',
    # --- Cumplimiento regulatorio automatizado (IA-034) ---
    'Automated regulatory compliance': 'Cumplimiento regulatorio automatizado',
    # --- Análisis de desviaciones con explicación automática (IA-040) ---
    'Generate account variance analysis and intelligent explanations':
        'Análisis de desviaciones con explicación automática',
    'generate account variance analysis and intelligent explanations':
        'Análisis de desviaciones con explicación automática',
    # --- Informes de gestión con comentario automático (IA-041) ---
    'Mgmt Reporting Actuals Plan Variance + Commentary':
        'Informes de gestión con comentario automático',
    'Mgmt reporting actuals/plan/variance + commentary':
        'Informes de gestión con comentario automático',
    # --- Analista digital de Finanzas bajo demanda (IA-042) ---
    'Chat with Finance data': 'Analista digital de Finanzas bajo demanda',
    'Digital Analyst on demand analytics': 'Analista digital de Finanzas bajo demanda',
    'Digital analyst': 'Analista digital de Finanzas bajo demanda',
    'FinanceAI Insights Platform': 'Analista digital de Finanzas bajo demanda',
    'Perform analysis and investigation and provide insights on demand':
        'Analista digital de Finanzas bajo demanda',
    # --- Patrones históricos para predecir el rendimiento (IA-043) ---
    'Identify past data patterns to predict and improve future financial performance':
        'Patrones históricos para predecir el rendimiento',
    'Identify patterns to predict future financial performance':
        'Patrones históricos para predecir el rendimiento',
    # --- Visión ejecutiva de la salud financiera (IA-044) ---
    'Executive financial health overview': 'Visión ejecutiva de la salud financiera',
    'Generate executive level overview of company financial health':
        'Visión ejecutiva de la salud financiera',
    'executive financial health overview': 'Visión ejecutiva de la salud financiera',
    # --- Consulta del dato en lenguaje natural (IA-045) ---
    'Data access for all': 'Consulta del dato en lenguaje natural',
    'Enterprise-wide data search and access': 'Consulta del dato en lenguaje natural',
    'Insights for all': 'Consulta del dato en lenguaje natural',
    # --- Síntesis multifuente para informes de análisis (IA-046) ---
    'Smarter intelligence': 'Síntesis multifuente para informes de análisis',
    # --- Recomendaciones de acción a nivel de proyecto (IA-047) ---
    'Project-level recommendations': 'Recomendaciones de acción a nivel de proyecto',
    'project-level recommendations': 'Recomendaciones de acción a nivel de proyecto',
    # --- Recomendaciones de resolución de incidencias (IA-048) ---
    'Proactive defect resolution recommendations': 'Recomendaciones de resolución de incidencias',
    'proactive defect resolution recommendations': 'Recomendaciones de resolución de incidencias',
    # --- Acceso y extracción documental (IA-049) ---
    'AI-powered archive access and extraction': 'Acceso y extracción documental',
    # --- Flujos guiados de elaboración presupuestaria (IA-050) ---
    'Develop guided workflows for creating budgets':
        'Flujos guiados de elaboración presupuestaria',
    # --- Previsión y escenarios bajo demanda (IA-051) ---
    'On demand forecasting and scenario modeling': 'Previsión y escenarios bajo demanda',
    # --- Asignación presupuestaria asistida por IA (IA-052) ---
    'AI-supported budget allocation': 'Asignación presupuestaria asistida por IA',
    # --- Resumen y puntuación de propuestas de inversión (IA-053) ---
    'Summarize and score project proposals': 'Resumen y puntuación de propuestas de inversión',
    'Summarize and score project proposals across the organization':
        'Resumen y puntuación de propuestas de inversión',
    # --- Planificación integrada de negocio (IA-054) ---
    'Integrated business planning': 'Planificación integrada de negocio',
    # --- Previsión predictiva de flujo de caja (IA-060) ---
    'Predictive cash flow forecasting tool': 'Previsión predictiva de flujo de caja',
    # --- Análisis de caja y riesgo de liquidez (IA-061) ---
    'Enhance cash flow analysis': 'Análisis de caja y riesgo de liquidez',
    'Enhance cash flow analysis, minimizing liquidity risks':
        'Análisis de caja y riesgo de liquidez',
    'Enhance cash flow analysis, minimizing liquidity risks, improving forecasting accuracy, and maximizing returns on cash holdings':
        'Análisis de caja y riesgo de liquidez',
    # --- Optimización de la liquidez intradía (IA-062) ---
    'Intraday liquidity optimization': 'Optimización de la liquidez intradía',
    # --- Optimización de operaciones de divisa (IA-063) ---
    'Optimize foreign exchange operations': 'Optimización de operaciones de divisa',
    'Optimize foreign exchange operations by evaluating foreign exchange data and identifying patterns and trends to reduce financial risks':
        'Optimización de operaciones de divisa',
    # --- Agentes de IA para trading y simulación de mercado (IA-064) ---
    'AI agents for algorithmic trading and market simulation':
        'Agentes de IA para trading y simulación de mercado',
    # --- Agentes de IA para análisis de riesgo crediticio (IA-065) ---
    'AI agents for credit underwriting': 'Agentes de IA para análisis de riesgo crediticio',
    # --- Valoración predictiva de la compañía (IA-066) ---
    'Predictive company valuation analyzing financial data':
        'Valoración predictiva de la compañía',
    # --- Generación de estrategias de inversión (IA-067) ---
    'Generate investing strategies': 'Generación de estrategias de inversión',
    'Generate investing strategies from consolidated market conditions':
        'Generación de estrategias de inversión',
    'Generate investing strategies from consolidated market conditions, internal financial performance, and firm objectives':
        'Generación de estrategias de inversión',
    # --- Generación de informes fiscales (IA-070) ---
    'Accurate tax report generation': 'Generación de informes fiscales',
    # --- Automatización de la presentación de impuestos (IA-071) ---
    'Automate tax filing processes, analyze financial data, and generate accurate tax reports':
        'Automatización de la presentación de impuestos',
    # --- Evaluación normativa y recomendación fiscal (IA-072) ---
    'Evaluate tax laws and regulations and provide recommendations':
        'Evaluación normativa y recomendación fiscal',
    'Evaluate tax laws and regulations and provide recommendations for tax planning, compliance, and risk management':
        'Evaluación normativa y recomendación fiscal',
    # --- Planificación fiscal predictiva (IA-073) ---
    'Predictive tax planning, compliance, and risk management': 'Planificación fiscal predictiva',
    # --- Detección y corrección de errores en facturas (IA-080) ---
    'Automated invoice error detection & correction':
        'Detección y corrección de errores en facturas',
    # --- Facturación de pedidos no estándar (IA-081) ---
    'Generate customized invoices for nonstandard customer orders':
        'Facturación de pedidos no estándar',
    # --- Gestión asistida del recobro (IA-082) ---
    'Facilitate payment collection to identify collections gaps and automate outreach':
        'Gestión asistida del recobro',
    # --- Condiciones de pago óptimas para el DSO (IA-083) ---
    'Recommend optimal payment terms to improve DSO': 'Condiciones de pago óptimas para el DSO',
    # --- Momento óptimo de pago a proveedores (IA-084) ---
    'Recommend most optimal payment timing': 'Momento óptimo de pago a proveedores',
    # --- Predicción de retraso e impago (IA-085) ---
    'Predicts late payments or defaults': 'Predicción de retraso e impago',
    # --- Lectura de contratos y obligaciones de desempeño (IA-086) ---
    'Read customer contracts and identify performance obligations':
        'Lectura de contratos y obligaciones de desempeño',
    # --- Previsión del gasto contratado con terceros (IA-087) ---
    'Using data from contract management system forecast monthly expense':
        'Previsión del gasto contratado con terceros',
    'Using data from contract management system, forecast monthly expense for all third-party contracts':
        'Previsión del gasto contratado con terceros',
    # --- Redacción de contratos y pliegos (IA-088) ---
    'Drafting contracts and SoWs': 'Redacción de contratos y pliegos',
    # --- Evaluación de proveedores con IA (IA-089) ---
    'Supplier assessment AI': 'Evaluación de proveedores con IA',
    # --- Planificación logística resiliente (IA-090) ---
    'Resilient logistics and planning': 'Planificación logística resiliente',
    # --- Redacción de recursos ante denegaciones (IA-091) ---
    'Denial appeal letters': 'Redacción de recursos ante denegaciones',
    # --- Mantenimiento predictivo de activos (IA-096) ---
    'AI-driven predictive maintenance': 'Mantenimiento predictivo de activos',
    # --- Detección de fugas de ingresos (IA-100) ---
    'Identify & proactively correct revenue leakage': 'Detección de fugas de ingresos',
    # --- Recomendación de demanda, coste y precio (IA-101) ---
    'Recommend demand planning, product costing, and pricing setting':
        'Recomendación de demanda, coste y precio',
    # --- Precio óptimo a partir de señales de mercado (IA-102) ---
    'Examine market trends, supplier behavior, and other factors to determine optimal prices':
        'Precio óptimo a partir de señales de mercado',
    # --- Precio dinámico y optimización de inventario (IA-103) ---
    'Dynamic pricing and inventory optimization': 'Precio dinámico y optimización de inventario',
    # --- Planificación de promociones (IA-104) ---
    'Planning for promotions': 'Planificación de promociones',
    # --- Operaciones comerciales inteligentes (IA-105) ---
    'Intelligent commercial operations': 'Operaciones comerciales inteligentes',
    # --- Asistente de RFP y de conocimiento comercial (IA-106) ---
    'AI-powered RFP and knowledge assistant': 'Asistente de RFP y de conocimiento comercial',
    # --- Personalización de ventas y marketing (IA-107) ---
    'Hyper-personalized sales and marketing assistant': 'Personalización de ventas y marketing',
    # --- Agentes de IA para el éxito del cliente (IA-108) ---
    'AI agents for customer success': 'Agentes de IA para el éxito del cliente',
    # --- Gestión dinámica de inventario (IA-110) ---
    'Dynamic inventory management': 'Gestión dinámica de inventario',
    # --- Operaciones autónomas de cadena de suministro (IA-111) ---
    'Autonomous supply chain operations': 'Operaciones autónomas de cadena de suministro',
    # --- Diseño de producto orquestado por IA (IA-112) ---
    'AI-orchestrated product design': 'Diseño de producto orquestado por IA',
    # --- Ensayos clínicos más inteligentes (IA-113) ---
    'Smarter clinical trials': 'Ensayos clínicos más inteligentes',
    # --- Descubrimiento autónomo de fármacos (IA-114) ---
    'End-to-end autonomous drug discovery and development': 'Descubrimiento autónomo de fármacos',
    # --- Monitorización predictiva del cumplimiento (IA-120) ---
    'Predictive compliance monitoring': 'Monitorización predictiva del cumplimiento',
    # --- Vigilancia continua de riesgo y cumplimiento (IA-121) ---
    'AI-powered risk management and regulatory compliance':
        'Vigilancia continua de riesgo y cumplimiento',
    # --- Apoyo a exámenes e inspecciones regulatorias (IA-122) ---
    'AI-supported regulatory examinations and inspections':
        'Apoyo a exámenes e inspecciones regulatorias',
    # --- Generación de datos sintéticos (IA-123) ---
    'Synthetic data generation': 'Generación de datos sintéticos',
    # --- Gestión de vulnerabilidades con IA (IA-124) ---
    'AI-driven vulnerability management': 'Gestión de vulnerabilidades con IA',
    # --- Informes de investigación y KYC (IA-127) ---
    'Research-based report generation / KYC': 'Informes de investigación y KYC',
    # --- Análisis del clean room de M&A (IA-130) ---
    'Recommend, summarize, and detect risk from M&A cleanroom data':
        'Análisis del clean room de M&A',
    # --- Asistente de código para la transformación (IA-131) ---
    'Code assistant for digital transformation': 'Asistente de código para la transformación',
    # --- Agentes de IA para ingeniería de software (IA-132) ---
    'AI agents for software engineering': 'Agentes de IA para ingeniería de software',
    # --- Inteligencia de mercado (IA-133) ---
    'Next-level market intelligence': 'Inteligencia de mercado',
    # --- Asistente de contenidos de comunicación (IA-134) ---
    'Marketing content assistant': 'Asistente de contenidos de comunicación',
    # --- Generación de contenido para el earnings call (IA-135) ---
    'Earnings call content generation': 'Generación de contenido para el earnings call',
    # --- Reporting estandarizado de revisión de desempeño (IA-136) ---
    'Standardized OPR reporting for performance management':
        'Reporting estandarizado de revisión de desempeño',
    # --- Detección de facturas duplicadas (IA-137) ---
    'Duplicate invoice identification and notification': 'Detección de facturas duplicadas',
    # --- Insights sobre el dato de proveedor (IA-138) ---
    'Vendor data insights': 'Insights sobre el dato de proveedor',
    # --- Modelos retadores para contrastar escenarios (IA-139) ---
    'Enable predictive challenger models to test various scenarios':
        'Modelos retadores para contrastar escenarios',
    # --- Asistente financiero para el cliente (IA-140) ---
    'Financial guardian': 'Asistente financiero para el cliente',
    # --- Respuesta asistida a requerimientos fiscales (IA-141) ---
    'Automation of tax notice response generation and audit support':
        'Respuesta asistida a requerimientos fiscales',
    # --- Borrador de informe de auditoría (IA-142) ---
    'Draft audit report generation': 'Borrador de informe de auditoría',
    # --- Generación de casos de prueba de control (IA-143) ---
    'Automated test case generation': 'Generación de casos de prueba de control',
    # --- Determinación de elegibilidad para incentivos (IA-144) ---
    'Automated eligibility determination': 'Determinación de elegibilidad para incentivos',
}
