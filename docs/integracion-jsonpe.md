# Integrar json.pe en cualquier proyecto con arquitectura desacoplada

> **Audiencia**: desarrolladores de cualquier nivel, incluso si recién empezás.
> **Objetivo**: que puedas consumir json.pe (o cualquier API peruana similar)
> en un proyecto nuevo, de forma que el día que cambies de proveedor toques
> **un solo archivo** en vez de buscar URLs por todo el código.
> **Stack**: cualquiera (Node, Python, PHP, Go, Java, etc.). Los conceptos
> son universales; los pseudo-ejemplos sirven para todos.

---

## 📋 Tabla de contenidos

1. [Qué es json.pe y para qué sirve](#1-qué-es-jsonpe-y-para-qué-sirve)
2. [Conceptos básicos que necesitás dominar](#2-conceptos-básicos-que-necesitás-dominar)
3. [Por qué desacoplar (con analogía)](#3-por-qué-desacoplar-con-analogía)
4. [Arquitectura propuesta: puerto + adaptador](#4-arquitectura-propuesta-puerto--adaptador)
5. [Contrato de cada endpoint de json.pe](#5-contrato-de-cada-endpoint-de-jsonpe)
6. [Manejo de errores: los 4 casos](#6-manejo-de-errores-los-4-casos)
7. [Plan de implementación paso a paso](#7-plan-de-implementación-paso-a-paso)
8. [Cómo cambiar de proveedor en el futuro](#8-cómo-cambiar-de-proveedor-en-el-futuro)
9. [Seguridad del token](#9-seguridad-del-token)
10. [Checklist final de implementación](#10-checklist-final-de-implementación)
11. [Preguntas frecuentes (FAQ)](#11-preguntas-frecuentes-faq)

---

## 1. Qué es json.pe y para qué sirve

**json.pe** es un servicio peruano que expone, a través de Internet, datos
oficiales que normalmente están en organismos del estado: RENIEC, SUNAT,
SUNARP, etc. Los entrega como respuestas JSON limpias, en milisegundos.

En lugar de:
- Entrar al sitio web de RENIEC y copiar/pegar a mano
- Hacer "scraping" (un programa que abre un navegador y simula clics) — frágil y lento
- Llamar a la API oficial de cada entidad (compleja, requiere convenios)

…hacés **una sola petición HTTP** a json.pe y te devuelve los datos
estructurados. La API te cobra por consultas (modelo "pay-per-use" o
suscripción mensual, depende del plan).

### Qué te resuelve json.pe (al momento de redactar esta guía)

| Endpoint | Para qué sirve | Datos que devuelve |
|---|---|---|
| `/api/dni` | Buscar datos de una persona por su DNI | Nombres, apellidos, dirección (cuando RENIEC la publica) |
| `/api/ruc` | Buscar datos de una empresa o persona-empresa por RUC | Razón social, estado SUNAT, condición, dirección, ubigeo |
| `/api/placa` | Buscar datos de un vehículo por su placa | Marca, modelo, color, motor, VIN/serie |
| `/api/tipo_de_cambio` | Obtener el tipo de cambio USD/PEN oficial (SUNAT) de una fecha | venta, compra, moneda, fecha SUNAT |

> ⚠️ **No incluye**: SBS (deudas en sistema financiero), MIGRACIONES (carnet
> de extranjería). Para esos endpoints necesitarías otro proveedor o seguir
> con scraping (factiliza y apisperu, por ejemplo, sí tienen SBS).

---

## 2. Conceptos básicos que necesitás dominar

Antes de implementar nada, asegurate de tener claros estos términos. Si ya
los manejás, salteá esta sección.

### 2.1 ¿Qué es una API?

Una **API** ("Application Programming Interface") es básicamente un **menú
de comidas** que un servidor ofrece a otros programas. Vos pedís algo
puntual ("dame los datos del DNI X"), te dan la respuesta y ya. El servidor
no te muestra una página web bonita, te tira **datos puros** en formato
JSON.

### 2.2 ¿Qué es un endpoint?

Un **endpoint** es una "puerta" específica de la API. json.pe tiene 3
puertas distintas:

```
https://api.json.pe/api/dni              ← puerta para consultar DNI
https://api.json.pe/api/ruc              ← puerta para consultar RUC
https://api.json.pe/api/placa            ← puerta para consultar placa
https://api.json.pe/api/tipo_de_cambio   ← puerta para consultar tipo de cambio USD/PEN
```

Cada puerta espera un tipo de pregunta distinta y te da un tipo de
respuesta distinta. La URL base (`https://api.json.pe`) es la misma para
todas.

### 2.3 ¿Qué es un token (Bearer)?

Un **token** es como una **llave única** que te identifica frente a la
API. Es un texto largo, generalmente generado al registrarte. Lo pasás en
cada petición para que la API sepa "este es Edward, déjalo pasar y descontale
una consulta de su plan".

En json.pe se manda como un **header HTTP** llamado `Authorization`:

```
Authorization: Bearer abc123tuTokenAcá...
```

> 🔒 **Crítico**: este token equivale a tu tarjeta de crédito. Si alguien lo
> roba puede consumir todo tu plan. NUNCA lo pongas en código que se sube a
> git. Ver sección 9 más adelante.

### 2.4 ¿Qué es JSON?

**JSON** ("JavaScript Object Notation") es el formato de texto en que se
viaja la información hoy en día en Internet. Tiene esta pinta:

```json
{
  "dni": "12345678",
  "nombre": "JUAN",
  "edad": 30,
  "activo": true,
  "direccion": null
}
```

Es legible para humanos y procesable para programas. La mayoría de
lenguajes de programación lo entienden de fábrica.

### 2.5 ¿Qué es un código HTTP?

Cuando hacés una petición a una API, además de los datos te llega un
**número de tres dígitos** que te dice qué pasó:

| Código | Significa |
|---|---|
| 200 | ✅ Todo bien, ahí van tus datos |
| 400 | ❌ Pediste mal (ej. placa con formato inválido) |
| 401 | ❌ Tu token está mal o no lo mandaste |
| 403 | ❌ Tu token es válido pero no tenés permiso para esto |
| 404 | ❌ Lo que pediste no existe (ej. DNI que no está en RENIEC) |
| 429 | ❌ Estás haciendo demasiadas peticiones (rate-limit) |
| 500 | ❌ La API se rompió, no es culpa tuya |

Tu código tiene que reaccionar distinto a cada uno.

---

## 3. Por qué desacoplar (con analogía)

### 3.1 El problema sin desacoplar

Imaginate que pones **enchufes europeos** clavados directamente en las
paredes de tu casa. Funciona perfecto mientras vivas en Europa. Pero el
día que te mudes a Perú, tenés que **picar todas las paredes** y poner
enchufes peruanos. Pesadilla.

En código, esto se ve así (mal ejemplo):

```
// archivo: clientes.ts
async function crearCliente(dni) {
  const datos = await fetch("https://api.json.pe/api/dni", {...});
  // ... usás los datos directamente con el formato de json.pe
}

// archivo: ventas.ts
async function buscarComprador(dni) {
  const datos = await fetch("https://api.json.pe/api/dni", {...});  // ← URL duplicada
  // ... otra vez con el formato de json.pe
}

// archivo: empleados.ts
async function fichar(dni) {
  const datos = await fetch("https://api.json.pe/api/dni", {...});  // ← URL duplicada otra vez
  // ...
}
```

El día que json.pe cambia de URL, sube precios, o se rompe… tenés que
**buscar todas las menciones** por tu código y modificarlas una por una.
Si tu proyecto tiene 50 archivos así, es semanas de trabajo.

### 3.2 La solución: usar un enchufe universal

Lo que hacés en la vida real es comprar un **adaptador de enchufe**: un
aparatito que tiene la forma europea por un lado y la forma peruana por
el otro. Tus electrodomésticos no saben ni les importa qué hay del otro
lado; solo le hablan al adaptador.

En código eso es:

```
// archivo nuevo: proveedorApi.ts (el ADAPTADOR)
function consultarDni(dni) {
  // Acá adentro, internamente, hablás con json.pe
  return await fetch("https://api.json.pe/api/dni", {...});
}

// archivo: clientes.ts
async function crearCliente(dni) {
  const datos = await consultarDni(dni);  // ← le habla al adaptador, no a json.pe
}

// archivo: ventas.ts
async function buscarComprador(dni) {
  const datos = await consultarDni(dni);  // ← idem
}

// archivo: empleados.ts
async function fichar(dni) {
  const datos = await consultarDni(dni);  // ← idem
}
```

Ahora si json.pe muere mañana y querés cambiarte a factiliza, **modificás
un solo archivo** (`proveedorApi.ts`) y los otros 50 archivos siguen
funcionando sin tocarlos.

Eso es **desacoplar**. Es la idea más importante de esta guía.

---

## 4. Arquitectura propuesta: puerto + adaptador

Vamos a estructurar el código en 3 piezas claramente separadas:

```
┌─────────────────────────────────────────────────────────────────┐
│  TU CÓDIGO DE NEGOCIO                                            │
│  (clientes.ts, ventas.ts, empleados.ts, lo que sea)              │
│                                                                  │
│  Usa la INTERFAZ. NO sabe nada de json.pe.                       │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ usa
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  PUERTO (interfaz/contrato)                                      │
│                                                                  │
│  Define QUÉ se puede hacer, sin importar quién lo haga:          │
│    - consultarDni(numero)  → ResultadoDni                        │
│    - consultarRuc(numero)  → ResultadoRuc                        │
│    - consultarPlaca(placa) → ResultadoPlaca                      │
│                                                                  │
│  Es solo el contrato. No tiene URLs ni tokens.                   │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ es implementada por
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  ADAPTADORES (implementaciones concretas)                        │
│                                                                  │
│  Cada uno habla con un proveedor distinto:                       │
│    - adaptadorJsonPe   → habla con json.pe                       │
│    - adaptadorFactiliza → habla con factiliza  (futuro)          │
│    - adaptadorDecolecta → habla con decolecta  (futuro)          │
│                                                                  │
│  Acá viven las URLs, los headers, el parseo de respuestas.       │
└─────────────────────────────────────────────────────────────────┘
```

### 4.1 Las tres piezas

**1. El puerto (contrato)**

Es una **promesa** que dice "quien sea que se conecte acá, va a poder
hacer estas 3 cosas, y va a devolver datos con esta forma específica".

En la mayoría de lenguajes esto se llama "interface" o "abstract class".

```
PUERTO = {
  consultarDni(numero: string)        → ResultadoConsulta<DatosDni>
  consultarRuc(numero: string)        → ResultadoConsulta<DatosRuc>
  consultarPlaca(placa: string)       → ResultadoConsulta<DatosVehiculo>
  consultarTipoCambio(fecha?: string) → ResultadoConsulta<DatosTipoCambio>
}
```

**2. Los tipos de datos normalizados**

Cada proveedor devuelve los datos con nombres distintos. json.pe le dice
`nombre_o_razon_social`; otro le diría `razonSocial` a secas; otro
`legal_name`. Para que TU código no tenga que saber esto, definís tus
**propios tipos** y el adaptador traduce.

```
DatosDni = {
  numero: string
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  nombreCompleto: string
  direccion: string
}

DatosRuc = {
  numero: string
  razonSocial: string
  estado: string
  condicion: string
  direccion: string
}

DatosVehiculo = {
  placa: string
  marca: string
  modelo: string
  color: string
  motor: string
  vin: string
}

DatosTipoCambio = {
  venta: number    // TC venta — el usado para valorizar operaciones en USD
  compra: number   // TC compra
  moneda: string   // 'USD' (par USD/PEN)
  fecha: string    // fecha SUNAT efectiva del TC (YYYY-MM-DD)
}
```

**3. El adaptador**

Es la implementación concreta. Conoce las URLs de json.pe, sabe cómo se
arma el header `Authorization`, sabe que la respuesta viene en
`data.nombre_o_razon_social` y la transforma a `razonSocial`.

Si el día de mañana json.pe cambia algo, **solo tocás este archivo**.

### 4.2 Estructura de carpetas sugerida

```
src/
├── proveedoresApi/
│   ├── tipos.ts                  ← DatosDni, DatosRuc, DatosVehiculo, ResultadoConsulta
│   ├── puerto.ts                 ← interfaz ProveedorApi
│   ├── adaptadores/
│   │   ├── jsonPe.adapter.ts     ← implementación para json.pe
│   │   ├── factiliza.adapter.ts  ← (futuro) implementación para factiliza
│   │   └── decolecta.adapter.ts  ← (futuro)
│   └── index.ts                  ← "fábrica": elige qué adapter usar según .env
└── ... (resto de tu app)
```

> 💡 El nombre de los archivos no es sagrado. Lo importante es que se
> note de un vistazo qué es cada cosa.

---

## 5. Contrato de cada endpoint de json.pe

Vamos a documentar la API tal cual la expone json.pe — esto es
**lenguaje-agnóstico**, vale para cualquier stack.

### 5.1 Cosas comunes a todos los endpoints

- **Método HTTP**: siempre `POST`
- **URL base**: `https://api.json.pe`
- **Headers obligatorios**:
  - `Authorization: Bearer <tu-token>`
  - `Content-Type: application/json`
- **Body**: JSON con un solo campo (depende del endpoint)
- **Respuesta éxito**: HTTP 200, body con `success: true`, `message: "exito"`, `data: { ... }`
- **Respuesta no encontrado**: HTTP 4xx, body con `success: false`, `message: "No se encontró ..."`

### 5.2 Endpoint DNI

**Request:**
```
POST https://api.json.pe/api/dni
Authorization: Bearer <token>
Content-Type: application/json

{
  "dni": "27427864"
}
```

**Respuesta éxito (HTTP 200):**
```json
{
  "success": true,
  "message": "exito",
  "data": {
    "numero": "27427864",
    "nombre_completo": "CASTILLO TERRONES, JOSE PEDRO",
    "nombres": "JOSE PEDRO",
    "apellido_paterno": "CASTILLO",
    "apellido_materno": "TERRONES",
    "codigo_verificacion": 7,
    "direccion": "",
    "direccion_completa": "",
    "ubigeo_reniec": "",
    "ubigeo_sunat": "",
    "ubigeo": [null, null, null]
  }
}
```

**Respuesta no encontrado (HTTP 404):**
```json
{
  "success": false,
  "message": "No se encontró DNI"
}
```

**Notas**:
- `direccion`/`direccion_completa` pueden venir vacíos si RENIEC no la publica.
- `codigo_verificacion` es el dígito verificador del DNI (uso interno, generalmente no se guarda).

### 5.3 Endpoint RUC

**Request:**
```
POST https://api.json.pe/api/ruc
Authorization: Bearer <token>
Content-Type: application/json

{
  "ruc": "20552103816"
}
```

**Respuesta éxito (HTTP 200):**
```json
{
  "success": true,
  "message": "exito",
  "data": {
    "ruc": "20552103816",
    "nombre_o_razon_social": "AGROLIGHT PERU S.A.C.",
    "estado": "SUSPENSION TEMPORAL",
    "condicion": "HABIDO",
    "departamento": "LIMA",
    "provincia": "LIMA",
    "distrito": "SANTA ANITA",
    "direccion": "PJ. JORGE BASADRE NRO. 158 URB. POP LA UNIVERSAL 2DA ET.",
    "direccion_completa": "PJ. JORGE BASADRE NRO. 158 URB. POP LA UNIVERSAL 2DA ET., LIMA - LIMA - SANTA ANITA",
    "ubigeo_sunat": "150137",
    "ubigeo": ["15", "1501", "150137"],
    "es_agente_de_retencion": "NO",
    "es_agente_de_percepcion": "NO",
    "es_agente_de_percepcion_combustible": "NO",
    "es_buen_contribuyente": "SI"
  }
}
```

**Respuesta no encontrado (HTTP 404):**
```json
{
  "success": false,
  "message": "No se encontró RUC"
}
```

**Notas**:
- `estado` puede ser: `ACTIVO`, `SUSPENSION TEMPORAL`, `BAJA DEFINITIVA`, `BAJA PROVISIONAL`, `INHABILITADO`.
- `condicion` puede ser: `HABIDO`, `NO HABIDO`, `NO HALLADO`.
- Los campos `es_*` son strings `"SI"`/`"NO"`, no booleanos (cuidado al parsear).

### 5.4 Endpoint Placa

**Request:**
```
POST https://api.json.pe/api/placa
Authorization: Bearer <token>
Content-Type: application/json

{
  "placa": "F3H792"
}
```

**Respuesta éxito (HTTP 200):**
```json
{
  "success": true,
  "message": "exito",
  "data": {
    "placa": "F3H792",
    "marca": "FIAT",
    "modelo": "FIORINO",
    "serie": "9BD25521A98854312",
    "color": "BLANCO BANCHISA",
    "motor": "8632404",
    "vin": "9BD25521A98854312"
  }
}
```

**Respuesta inválida (HTTP 400):**
```json
{
  "success": false,
  "message": "Bad Request"
}
```

**Notas importantes**:
- El campo **propietario NO viene**. Ninguna API peruana pública lo trae sin convenio especial; solo se obtiene scrapeando el portal oficial de SUNARP. Si tu proyecto lo necesita, tendrás que combinar json.pe + scraping (caro y frágil) o aceptar la pérdida del dato.
- Mandar la placa **sin guion** (`F3H792`, no `F3H-792`).
- `serie` y `vin` suelen ser iguales.

### 5.5 Endpoint Tipo de Cambio

**Request:**
```
POST https://api.json.pe/api/tipo_de_cambio
Authorization: Bearer <token>
Content-Type: application/json

{
  "fecha": "2024-01-15"
}
```

**Respuesta éxito (HTTP 200):**
```json
{
  "success": true,
  "message": "exito",
  "data": {
    "moneda": "USD",
    "fecha_busqueda": "2024-01-15",
    "fecha_sunat": "2024-01-15",
    "venta": 3.696,
    "compra": 3.69,
    "date": "2024-01-15",
    "sale": 3.696,
    "purchase": 3.69
  }
}
```

**Respuesta inválida (HTTP 400):**
```json
{
  "success": false,
  "message": "Bad Request"
}
```

**Notas importantes**:
- La **fuente del dato es SUNAT** — el TC oficial para conversiones tributarias
  (facturación electrónica), así que para un ERP es el correcto.
- **`fecha` es obligatoria**, formato `YYYY-MM-DD`. Si se omite, mandá la de hoy.
- **json.pe resuelve fechas sin publicación**: probado con sábados y feriados,
  devuelve HTTP 200 con el **TC vigente más cercano** (el último día hábil con
  publicación). Por eso **no hace falta reintentar al día anterior** desde tu código.
- `venta`/`compra` (español) duplican `sale`/`purchase` (inglés) — usá cualquiera;
  normalizá a `venta`/`compra` con fallback al inglés.
- **`venta` es el TC que se usa para valorizar** ventas/compras registradas en USD.

> 💡 **Buena práctica**: si la API falla, el estimado de respaldo se marca como
> `fuente: 'estimado'` y la UI lo pinta en ámbar. Un fallback silencioso que no se
> distingue del dato real es un bug esperando a pasar: el operador debe ver siempre
> si el valor que está usando es oficial o estimado.

---

## 6. Manejo de errores: los 4 casos

Esta es la sección **más importante** de la guía. Si la pifiás acá, tu
sistema va a marcar como "DNI no existe" cosas que en realidad fallaron
por rate-limit, y tu jefe va a venir a pedirte explicaciones.

### 6.1 Los cuatro casos posibles

Cuando consultás cualquier endpoint, **siempre** puede pasar una de estas
4 cosas:

| Caso | Qué significa | Qué hacer |
|---|---|---|
| **`datos`** | Todo bien, tenés los datos | Usás los datos |
| **`sin_datos`** | El doc/placa **realmente no existe** | Avisás al usuario "no encontrado" |
| **`error_tecnico`** | La API falló (rate-limit, red, token vencido) | Decís "reintentar más tarde" |
| **`fuera_de_servicio`** | No configuraste el adapter (sin token) | Caso solo en dev/staging |

### 6.2 Por qué importa distinguirlos

Imagina dos escenarios desde la perspectiva del usuario:

1. Escribe el DNI `99999999`, le sale "no encontrado". → **Correcto**: ese DNI no existe.
2. Escribe el DNI `12345678` (existe), le sale "no encontrado" porque la API estaba caída. → **MAL**: el usuario pensará que el DNI no existe cuando en realidad es un problema técnico.

El caso 2 es lo que pasaba en sistemas mal diseñados antes de esta guía:
todo fallo se marcaba igual y el usuario perdía la confianza.

### 6.3 Cómo se distinguen en json.pe

| Respuesta de json.pe | Caso a usar |
|---|---|
| HTTP 200 + `success: true` + `data` presente | **`datos`** |
| Cualquier HTTP + `success: false` + `message: "No se encontró ..."` | **`sin_datos`** |
| HTTP 401 o 403 (token inválido) | **`error_tecnico`** |
| HTTP 429 (rate-limit) | **`error_tecnico`** |
| HTTP 500+ (servidor caído) | **`error_tecnico`** |
| Timeout de conexión (red caída) | **`error_tecnico`** |
| Token no configurado en `.env` | **`fuera_de_servicio`** |

### 6.4 Tipo recomendado: ResultadoConsulta

En lugar de devolver el dato directo (que te obliga a usar `null` o
`throw` y perdés información), devolvé un **objeto discriminado** que
distingue los 4 casos. En pseudocódigo:

```
ResultadoConsulta<T> = uno-de:
  | { tipo: "datos",              datos: T }
  | { tipo: "sin_datos" }
  | { tipo: "error_tecnico",      mensaje: string }
  | { tipo: "fuera_de_servicio",  mensaje: string }
```

Quien recibe el resultado **debe** chequear el `tipo` antes de leer
`datos`. Esto es seguro porque el lenguaje (si tipa fuerte) te obliga.

### 6.5 Ejemplo conceptual de uso

```
resultado = await proveedor.consultarDni("12345678")

cuando resultado.tipo === "datos":
    mostrarFormularioPrellenado(resultado.datos.nombres, resultado.datos.apellidoPaterno)

cuando resultado.tipo === "sin_datos":
    mostrar("Este DNI no existe en RENIEC. Verifica el número o continúa manualmente.")

cuando resultado.tipo === "error_tecnico":
    mostrar("No pudimos verificar el DNI ahora. Reintenta en unos minutos.")
    registrarLog(resultado.mensaje)  // para que el admin investigue

cuando resultado.tipo === "fuera_de_servicio":
    // Generalmente no debería pasar en producción
    mostrar("El servicio no está configurado. Avisa al administrador.")
```

---

## 7. Plan de implementación paso a paso

### Paso 1 — Obtener el token de json.pe

1. Andá a `https://json.pe` (o el portal del proveedor).
2. Registrate.
3. Suscribite a un plan o quedate en el gratuito si tienen.
4. Copiá el token que te dan. **Va a verse como un texto largo aleatorio**.

> Si no entendés cómo se ve un token, mira la sección 2.3 más arriba.

### Paso 2 — Guardar el token de forma segura

**Crea un archivo `.env` en la raíz de tu proyecto** (si no existe ya):

```
JSONPE_API_TOKEN=ahí-pegas-el-token-largo-que-te-dieron
```

**Agregá `.env` al `.gitignore`** (si no estaba):

```
# Archivos con secretos — NUNCA subir a git
.env
.env.local
```

> 🔒 Si ya hiciste commit del `.env` por error, asumí que el token está
> comprometido y pedí uno nuevo al proveedor. Borrar el archivo de git no
> basta porque queda en la historia.

### Paso 3 — Definir los tipos compartidos

Creá un archivo (`tipos.ts` o `tipos.py` según tu lenguaje) con:

- `ResultadoConsulta<T>` (los 4 casos del punto 6.4)
- `DatosDni`, `DatosRuc`, `DatosVehiculo` (los modelos normalizados del punto 4.1)

> Estos tipos son **TU contrato**. No copies tal cual los campos de
> json.pe; quedate solo con los que vas a usar, y normalizá los nombres
> a tu estilo (`razonSocial` mejor que `nombre_o_razon_social`).

### Paso 4 — Definir el puerto (interfaz)

Creá `puerto.ts` (o equivalente) con:

```
ProveedorApi:
  nombre: string  (solo para logs/debug)
  disponible: boolean  (verifica si está configurado)
  consultarDni(numero) → ResultadoConsulta<DatosDni>
  consultarRuc(numero) → ResultadoConsulta<DatosRuc>
  consultarPlaca(placa) → ResultadoConsulta<DatosVehiculo>
```

> En lenguajes con interfaces (TypeScript, Java, C#, Go) usá la
> sintaxis nativa. En lenguajes sin interfaces (Python, JS), podés usar
> un **protocolo** / **abstract base class** / **duck-typing
> documentado**.

### Paso 5 — Implementar el adaptador de json.pe

Creá `adaptadores/jsonPe.adapter.ts` (o equivalente). Debe:

1. **Leer el token de la variable de entorno** `JSONPE_API_TOKEN`.
2. **Implementar los 3 métodos del puerto**.
3. **Para cada método**:
   - Validar el formato del input (DNI 8 dígitos, RUC 11, placa 6-8 alfanuméricos)
   - Hacer el POST a la URL correspondiente
   - Pasar el header `Authorization: Bearer ${token}`
   - **Clasificar la respuesta** en uno de los 4 casos del punto 6.3
   - **Normalizar los datos** (mapear `nombre_o_razon_social` → `razonSocial`)
4. **Manejar excepciones de red** (timeout, sin conexión) y devolverlas como `error_tecnico`.

### Paso 6 — Crear el "factory" (fábrica)

Creá `index.ts` con una función que **devuelva la instancia activa del adaptador**:

```
funcion obtenerProveedorApi() → ProveedorApi:
  segun process.env.API_PROVEEDOR (default "jsonpe"):
    caso "jsonpe":    devolver new JsonPeAdapter()
    caso "factiliza": devolver new FactilizaAdapter()  // futuro
    default:          devolver new JsonPeAdapter()
```

> Esto permite que el día de mañana cambies de proveedor con una sola
> línea en `.env`: `API_PROVEEDOR=factiliza`. No tocás ningún otro archivo.

### Paso 7 — Usar el proveedor desde tu código de negocio

En tus features (clientes, ventas, lo que sea), **importás la factory**,
nunca el adapter directo:

```
import { obtenerProveedorApi } from "ruta/al/index"

funcion crearClienteDesdeDni(dni):
    proveedor = obtenerProveedorApi()
    resultado = await proveedor.consultarDni(dni)

    si resultado.tipo === "datos":
        guardarCliente(resultado.datos)
    sino:
        manejarOtrosCasos(resultado)
```

> ⚠️ **Nunca importes `JsonPeAdapter` directamente**. Importá siempre el
> resultado de `obtenerProveedorApi()`. Si lo importás directo, perdés
> el desacople.

### Paso 8 — Configurar producción

En tu servidor (Azure, AWS, Heroku, etc.) **configurá las variables de
entorno**:

- `JSONPE_API_TOKEN` con el token de producción (puede ser distinto al de dev)
- `API_PROVEEDOR=jsonpe` (opcional, es el default)

> Cada plataforma tiene su forma. En Azure Container Apps son
> "secret references". En AWS son "parameter store". En Heroku son
> "config vars". Lee la documentación de tu plataforma.

### Paso 9 — Probar

Antes de declarar terminada la integración, hacé estas 4 pruebas
obligatorias:

| Caso | Cómo probarlo | Resultado esperado |
|---|---|---|
| **Doc válido** | DNI que existe (el tuyo) | `tipo: "datos"`, datos correctos |
| **Doc inválido** | DNI inventado (`12345678`) | `tipo: "sin_datos"` |
| **Token mal** | Cambiá el token a uno falso temporalmente | `tipo: "error_tecnico"`, mensaje claro |
| **Token ausente** | Borrá la variable `JSONPE_API_TOKEN` temporalmente | `tipo: "fuera_de_servicio"` |

Si las 4 funcionan como esperás, la integración está sana.

---

## 8. Cómo cambiar de proveedor en el futuro

Esto es la prueba de fuego del desacople. Imaginate que dentro de 6 meses
json.pe muere o sube precios y querés usar `factiliza.com`. Pasos:

### 8.1 Investigar el nuevo proveedor

1. Leé sus docs.
2. Conseguí cURL de ejemplo de DNI / RUC / placa con respuestas reales.
3. Identificá:
   - URL base y rutas exactas
   - Método HTTP (GET o POST)
   - Cómo se manda el token (Bearer, header custom, query param)
   - Campos del JSON de respuesta (puede que use `legal_name` en lugar de `razonSocial`)
   - Cómo identifica "no encontrado" (404? `success: false`? campo `error`?)

### 8.2 Crear un nuevo adaptador

Creá `adaptadores/factiliza.adapter.ts` (o el nombre que sea), implementando el **mismo puerto**. Toda la lógica específica de factiliza vive ahí:

- URLs hardcoded en constantes
- Mapeo de campos (`legal_name` → `razonSocial`)
- Lógica de clasificación en los 4 casos

### 8.3 Agregar al factory

En `index.ts`:

```
caso "factiliza":
    devolver new FactilizaAdapter()
```

### 8.4 Configurar variables nuevas

En `.env`:
```
FACTILIZA_API_TOKEN=el-token-nuevo
API_PROVEEDOR=factiliza
```

### 8.5 Probar y deployar

Volvés a correr las 4 pruebas del Paso 9. Si todo OK, deploy. **Cero
cambios en clientes.ts, ventas.ts, ni ningún feature**. Esa es la
recompensa de haber hecho desacople.

### 8.6 Mantener json.pe como fallback (opcional)

Si querés ser cauto, podés tener un "orquestador" que intente factiliza
primero y json.pe como respaldo si factiliza falla técnicamente. Esto se
implementa con `Promise.any` (o equivalente) entre ambos adapters. Es
opcional y agrega complejidad — solo hacelo si te preocupa la
disponibilidad.

---

## 9. Seguridad del token

### 9.1 Reglas no negociables

1. **NUNCA** lo escribas en código que se sube a git.
2. **SIEMPRE** está en variable de entorno (`.env` local, secret manager
   en prod).
3. **NUNCA** lo logueés. Si necesitás loguear que falló auth, escribí
   "token inválido", no el token.
4. **NUNCA** lo expongas al frontend. La llamada a json.pe debe hacerse
   **desde tu backend**. Si lo expones al frontend, cualquier usuario
   puede abrir DevTools y robarlo.
5. **Rotalo periódicamente** (cambialo cada 3-6 meses). Si el proveedor
   te lo permite.

### 9.2 Cómo manejarlo en producción según plataforma

| Plataforma | Mecanismo |
|---|---|
| **Azure Container Apps / App Service** | Secret references + Key Vault |
| **AWS (Lambda, ECS, EC2)** | AWS Secrets Manager o Parameter Store |
| **Google Cloud Run** | Secret Manager |
| **Heroku** | Config Vars (`heroku config:set JSONPE_API_TOKEN=...`) |
| **Vercel / Netlify** | Environment Variables en el dashboard |
| **Docker Compose self-hosted** | Variables de entorno + `.env` con permisos restrictivos (`chmod 600 .env`) |

### 9.3 Qué hacer si filtraste el token

1. **Inmediatamente** revoká el token desde el panel del proveedor.
2. Pedí un token nuevo.
3. Configurá el nuevo en todos los entornos.
4. Revisá los logs del proveedor: si hay consumo sospechoso, hablá con
   soporte para que te lo descuenten (muchos lo hacen).
5. Borrá el commit con el secret de la historia con `git filter-repo` o
   pedí a GitHub que invalide el repo si era público.

---

## 10. Checklist final de implementación

Cuando termines, recorré esta lista para asegurarte que no te olvidaste
nada:

### Estructura de código
- [ ] Existe carpeta `proveedoresApi/` (o equivalente) con subcarpeta `adaptadores/`
- [ ] Existe archivo de **tipos** con `ResultadoConsulta<T>`, `DatosDni`, `DatosRuc`, `DatosVehiculo`
- [ ] Existe archivo de **puerto** con la interfaz `ProveedorApi`
- [ ] Existe **adapter de json.pe** que implementa el puerto
- [ ] Existe **factory** que devuelve el adapter activo según env var

### Seguridad
- [ ] `JSONPE_API_TOKEN` está en `.env`
- [ ] `.env` está en `.gitignore`
- [ ] El token NO aparece en ningún commit (`git log -S "tu-token"` no debe encontrarlo)
- [ ] El token NO aparece en código frontend
- [ ] Producción tiene el token en su gestor de secretos (Key Vault, etc.)

### Robustez
- [ ] El adapter clasifica las respuestas en los 4 casos (`datos`, `sin_datos`, `error_tecnico`, `fuera_de_servicio`)
- [ ] El adapter maneja timeout de red
- [ ] El adapter normaliza los nombres de campos (mapeo a tus tipos, no exponés los nombres de json.pe)
- [ ] El adapter normaliza datos (mayúsculas, trim, decode de entidades HTML si aplica)

### Consumidores
- [ ] Tu código de negocio importa la **factory**, no el adapter directo
- [ ] Tu código de negocio chequea el `tipo` del `ResultadoConsulta` antes de leer datos
- [ ] Cada uno de los 4 casos tiene una experiencia de usuario clara

### Pruebas
- [ ] Probaste con doc válido → `datos`
- [ ] Probaste con doc inválido → `sin_datos`
- [ ] Probaste con token corrupto → `error_tecnico`
- [ ] Probaste sin token configurado → `fuera_de_servicio`

### Documentación interna
- [ ] En el README del proyecto está documentado qué variables de
      entorno necesita (al menos `JSONPE_API_TOKEN`)
- [ ] Existe un `.env.example` con todas las vars (con valor placeholder)
- [ ] Si el equipo tiene varios devs, todos saben dónde está el panel
      de json.pe para revisar consumo

---

## 11. Preguntas frecuentes (FAQ)

### ¿Tengo que pagar por json.pe?

Depende. La mayoría de APIs peruanas tienen un plan gratuito con cuota
mensual baja (100-1000 consultas) y planes pagos para volúmenes mayores.
Revisá la documentación del proveedor al momento de registrarte.

### ¿Cuántas consultas por minuto soporta?

Cada proveedor tiene su propio rate-limit. json.pe no documenta uno
explícito al momento de escribir esta guía. En la práctica responde bien
a ráfagas de 5-10 consultas/segundo. Para volúmenes mayores conviene
implementar un throttle del lado del cliente.

### ¿Qué pasa si json.pe se cae?

Tu código va a recibir `tipo: "error_tecnico"`. Tenés 3 opciones:
1. Mostrar al usuario "intenta en unos minutos" y listo.
2. Implementar reintentos automáticos con backoff exponencial.
3. Implementar un fallback (otro proveedor o scraping) para los casos
   críticos.

### ¿Puedo usar el mismo adapter para varios proyectos?

Sí, eso es justamente la ventaja del desacople. Podés copiar el archivo
del adapter a otros proyectos (mantenélos sincronizados manualmente), o
publicarlo como un paquete privado de tu organización (npm, pypi, etc.).

### ¿Por qué json.pe usa POST en lugar de GET?

Es una decisión de diseño del proveedor (no muy ortodoxa para
"lecturas", pero válida). Te obliga a mandar el cuerpo en JSON.

### ¿Es legal usar estas APIs?

Sí. Los datos que exponen (RENIEC, SUNAT, SUNARP) son **públicos por
ley peruana**. Lo que pagás al proveedor es la **comodidad** de tenerlos
en formato API. Distinto sería usar APIs no autorizadas para extraer
datos privados — eso sí sería ilegal.

### ¿Y si necesito un campo que json.pe no devuelve?

Tres opciones:
1. **Aceptar la pérdida** (campo queda vacío) — más simple
2. **Combinar con otro proveedor** que sí lo tenga — agregás un adapter
3. **Hacer scraping del sitio oficial** — frágil y caro, solo si es
   crítico para el negocio

### ¿Cómo testeo el adapter sin gastar consultas reales?

Hacé "mocks" o "stubs" del adapter en tus tests unitarios. Como el
adapter implementa una interfaz (`ProveedorApi`), podés crear una clase
falsa que implementa la misma interfaz y devuelve datos canned. Esa es
otra ventaja del puerto/adapter.

### ¿El patrón funciona también para frontend?

**No directamente**. El frontend nunca debe llamar a json.pe (ni
ninguna API con token secreto) porque el token quedaría expuesto.
Tu backend hace de "proxy": frontend → tu backend → json.pe.

### ¿Y si quiero cachear resultados?

Excelente idea para ahorrar consultas. Lo recomendado es agregar un
**wrapper** (no modificar el adapter) que chequee cache antes de
delegar al adapter. Patrón "decorator":

```
ProveedorApiConCache:
  consultarDni(numero):
    si cache.tiene(numero):
        devolver cache.obtener(numero)
    resultado = adaptadorReal.consultarDni(numero)
    si resultado.tipo === "datos":
        cache.guardar(numero, resultado, ttl=30dias)
    devolver resultado
```

Tu factory devuelve el wrapper en lugar del adapter directo. Y como
ambos implementan el mismo puerto, tu código de negocio no nota nada.

---

## Cierre

Si seguiste la guía hasta acá tenés:

- ✅ Una integración a json.pe que funciona
- ✅ Estructura desacoplada que te permite cambiar de proveedor sin dolor
- ✅ Manejo correcto de los 4 casos (datos / sin datos / error técnico / fuera de servicio)
- ✅ Seguridad básica del token
- ✅ Bases para escalar (cache, fallback, multi-proveedor)

El patrón **puerto + adaptador** que aprendiste sirve para mucho más que
json.pe. Lo podés aplicar a cualquier servicio externo: pasarelas de
pago, envío de emails, almacenamiento de archivos, etc. La idea siempre
es la misma: **tu código de negocio no debe saber con quién está
hablando del otro lado**.

Cualquier duda o mejora a esta guía, edita este archivo y abrí un PR.
