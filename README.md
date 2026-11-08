# Sellos · Tarjetas de lealtad digitales

Sellos es una app web para cafés, fondas y negocios pequeños. Cada negocio tiene su propia tarjeta de sellos con su logo y colores. Sus clientes la usan desde el celular **sin descargar nada y sin contraseñas**. Funciona en **iPhone y Android**.

- **Clientes:** escanean el QR del mostrador, se registran en segundos y guardan su tarjeta en la pantalla de inicio.
- **Empleados:** entran con un PIN y sellan con la cámara (escanear → confirmar). Si la cámara falla, pueden buscar al cliente por teléfono.
- **Dueños:** configuran su tarjeta, ven reportes, clientes, clientes en riesgo, exportan a CSV e imprimen el cartel del QR.
- **Tú (superadmin):** das de alta, editas, suspendes y revisas negocios.

Todo está en español de México, con precios en MXN y hora del centro de México (`America/Mexico_City`).

> ⚠️ **Antes de usarla con clientes reales**, pide a un abogado que revise el aviso de privacidad y los términos. Los textos incluidos son un **borrador** y así se indica en la app.

---

## Índice

1. [Qué necesitas](#1-qué-necesitas)
2. [Configurar Supabase (base de datos)](#2-configurar-supabase-base-de-datos)
3. [Subir el código a GitHub](#3-subir-el-código-a-github)
4. [Publicar en Vercel](#4-publicar-en-vercel)
5. [Crear tu usuario de superadmin](#5-crear-tu-usuario-de-superadmin)
6. [Dar de alta un negocio nuevo (menos de 10 minutos)](#6-dar-de-alta-un-negocio-nuevo-menos-de-10-minutos)
7. [Negocios de demostración](#7-negocios-de-demostración)
8. [Uso diario](#8-uso-diario)
9. [Seguridad y privacidad](#9-seguridad-y-privacidad)
10. [Cobros (para después)](#10-cobros-para-después)
11. [Pruebas](#11-pruebas)
12. [Desarrollo en tu computadora](#12-desarrollo-en-tu-computadora)
13. [Solución de problemas](#13-solución-de-problemas)
14. [Cómo está hecho](#14-cómo-está-hecho)

---

## 1. Qué necesitas

Crea estas tres cuentas. Las tres tienen plan gratuito para empezar:

| Servicio | Para qué sirve | Enlace |
|---|---|---|
| GitHub | Guardar el código | https://github.com |
| Supabase | Base de datos, inicios de sesión y logos | https://supabase.com |
| Vercel | Publicar la app en internet | https://vercel.com (entra con tu cuenta de GitHub) |

Para los pasos opcionales (datos de demo y pruebas) también necesitas **Node.js 20 o más reciente** en tu computadora (https://nodejs.org, botón "LTS").

---

## 2. Configurar Supabase (base de datos)

Toma unos 5 minutos.

1. En https://supabase.com/dashboard da clic en **New project**.
   - **Name:** `sellos`.
   - **Database Password:** da clic en *Generate a password* y guárdala en un lugar seguro.
   - **Region:** elige **East US (North Virginia)**. Es la más cercana a Guadalajara entre las comunes y coincide con la región por defecto de Vercel.
   - Da clic en **Create new project** y espera a que termine (1 o 2 minutos).
2. **Crea las tablas y la seguridad.**
   - En el menú de la izquierda abre **SQL Editor** → **New query**.
   - Abre el archivo [`supabase/instalar-todo.sql`](supabase/instalar-todo.sql) de este proyecto, copia **todo** su contenido y pégalo.
   - Da clic en **Run**. Debe decir *Success. No rows returned*.
3. **Cierra los registros públicos.** Solo tú creas las cuentas de los dueños.
   - Ve a **Authentication** → **Sign In / Providers** (en algunas versiones, **Authentication → Settings**).
   - Desactiva **Allow new users to sign up** y guarda.
4. **Copia tus llaves.** Ve a **Project Settings** → **API** (o **API Keys**) y anota:
   - **Project URL**, por ejemplo `https://abcdxyz.supabase.co`.
   - La llave **pública**: *anon public* o *Publishable key*.
   - La llave **secreta**: *service_role* o *Secret key*. 🔒 Nunca la compartas ni la pongas en el código.

> El bucket `logos` (donde se guardan los logos) se crea solo con el SQL del paso 2. Para confirmarlo, abre **Storage**.

---

## 3. Subir el código a GitHub

1. En GitHub da clic en **New repository**, ponle `sellos`, márcalo como **Private** y créalo.
2. Sube esta carpeta al repositorio. Si nunca lo has hecho, usa GitHub Desktop (https://desktop.github.com): **File → Add local repository**, elige la carpeta y luego **Publish repository**.

El archivo `.gitignore` ya impide que se suban tus llaves (`.env.local`) y las credenciales de demo.

---

## 4. Publicar en Vercel

1. En https://vercel.com/new elige tu repositorio `sellos` y da clic en **Import**.
2. Abre **Environment Variables** y agrega estas cinco variables. Están explicadas también en [`.env.example`](.env.example):

   | Nombre | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | El *Project URL* de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | La llave **pública** |
   | `SUPABASE_SERVICE_ROLE_KEY` | La llave **secreta** |
   | `NEXT_PUBLIC_APP_URL` | Tu dirección de Vercel, por ejemplo `https://sellos.vercel.app` (sin `/` al final) |
   | `IP_HASH_SALT` | Un texto aleatorio de unos 40 caracteres. Genéralo en https://www.random.org/strings/ |

3. Da clic en **Deploy** y espera 2 o 3 minutos.
4. Si tu dirección final es distinta a la que pusiste en `NEXT_PUBLIC_APP_URL`, corrígela en **Settings → Environment Variables** y luego ve a **Deployments → ⋯ → Redeploy**.
5. En Supabase ve a **Authentication → URL Configuration** y en **Site URL** pon tu dirección de Vercel.
6. **(Recomendado)** En Vercel abre **Settings → Functions → Function Region** y elige la misma región que Supabase (*Washington, D.C., USA – iad1*). Así el sellado responde más rápido.

> Para usar tu propio dominio (por ejemplo `tarjetas.tunegocio.mx`), agrégalo en **Settings → Domains** y actualiza `NEXT_PUBLIC_APP_URL` y el *Site URL* de Supabase.

---

## 5. Crear tu usuario de superadmin

**Opción A: desde el navegador, sin instalar nada.**

1. En Supabase abre **Authentication → Users → Add user → Create new user**.
2. Escribe tu correo y una contraseña larga (por ejemplo, de un gestor de contraseñas). Marca **Auto Confirm User** y crea el usuario.
3. En **SQL Editor** ejecuta esto, cambiando el correo por el tuyo:
   ```sql
   insert into public.platform_admins (user_id)
   select id from auth.users where email = 'tu@correo.com';
   ```
4. Entra a `https://TU-APP.vercel.app/entrar` con ese correo y contraseña.

**Opción B: desde tu computadora.** Necesitas Node.js y el archivo `.env.local` (ver [sección 12](#12-desarrollo-en-tu-computadora)). Este comando genera una contraseña aleatoria y la muestra una sola vez:

```bash
npm run crear-superadmin -- tu@correo.com
```

---

## 6. Dar de alta un negocio nuevo (menos de 10 minutos)

Ten a la mano el nombre del negocio, el correo del dueño y su logo.

| Paso | Dónde | Tiempo |
|---|---|---|
| 1. Entra como superadmin y da clic en **+ Nuevo negocio**. Escribe el nombre (la dirección web se sugiere sola), el correo del dueño, el estado (*Prueba* o *Activo*) y la fecha de fin de prueba. | `/admin` | 1 min |
| 2. **Copia los datos de acceso** que aparecen (la contraseña se muestra una sola vez) y envíaselos al dueño por un medio privado. | misma pantalla | 1 min |
| 3. Da clic en **Configurar su tarjeta**. Sube el logo: los colores se sugieren solos y puedes cambiarlos. Elige el icono del sello y revisa la vista previa. | Mi tarjeta | 3 min |
| 4. Ajusta las reglas (sellos necesarios, premio, regalo, horario de doble sello, vigencia, restricciones) y el **ticket promedio**. Da clic en **Guardar cambios**. | Mi tarjeta | 2 min |
| 5. En **Empleados**, agrega al menos un empleado. Usa **Generar** para crear el PIN y anótalo. | Empleados | 1 min |
| 6. En **Cartel QR**, descarga el PDF e imprímelo para el mostrador. | Cartel QR | 1 min |
| 7. En el celular del mostrador abre `/n/SU-DIRECCION/staff`, entra con el PIN y agrégalo a la pantalla de inicio. Haz una prueba: registra tu propio número y séllalo. | Celular del negocio | 1 min |

Listo. Si el negocio deja de pagar, ve a **Superadmin → Editar → Estado: Suspendido**.

---

## 7. Negocios de demostración

Para enseñar la app a posibles clientes, el proyecto incluye dos negocios ficticios con logo, colores, clientes, visitas y canjes de los últimos 4 meses:

- **Café Colibrí** (cafetería): `/n/demo-cafe-colibri`
- **Fonda Doña Lupe** (fonda): `/n/demo-fonda-dona-lupe`

Para crearlos, o regenerarlos con claves nuevas, en tu computadora con `.env.local` apuntando a tu Supabase:

```bash
npm run demo
```

El comando imprime las credenciales: correo y contraseña de cada dueño, PIN de cada empleado y un enlace de tarjeta de ejemplo. También las guarda en `credenciales-demo.txt`, que **no** se sube a GitHub. Todas las claves son aleatorias. Si alguna se filtra, vuelve a ejecutar el comando: borra los dos negocios demo y los crea de nuevo con claves nuevas.

---

## 8. Uso diario

### Para los clientes
1. Escanean el QR del cartel con la cámara del celular.
2. Escriben nombre, WhatsApp y, si quieren, su cumpleaños.
3. Aceptan el aviso de privacidad (obligatorio). Recibir promociones es opcional y viene desmarcado.
4. Ven su tarjeta con los sellos de regalo. Para sellar, tocan **Mostrar mi código para sellar**.
5. Para guardarla en la pantalla de inicio:
   - **iPhone:** en Safari, botón **Compartir** → **Agregar a inicio**.
   - **Android:** en Chrome, menú **⋮** → **Agregar a la pantalla principal** o **Instalar app**.
6. Desde su tarjeta pueden dejar de recibir promociones o **dar de baja su cuenta**.

**¿Cambió de celular?** En el mostrador, el empleado busca su número, toca **Recuperar tarjeta** y le muestra un QR que vale 10 minutos y sirve una sola vez. El enlace anterior deja de funcionar. Nadie puede ver la tarjeta de otra persona solo con saber su número.

### Para los empleados
- Entran en `/n/SU-NEGOCIO/staff` con su PIN de 4 a 6 dígitos.
- **Cámara:** apuntan al QR del cliente, aparece su nombre con sus sellos y tocan **Sellar +1**.
- **Si la cámara falla:** pestaña **Buscar teléfono**, escriben los últimos 4 dígitos o el número completo.
- **Deshacer:** durante 2 minutos aparece el botón **Deshacer** del último sello.
- **Canjear:** cuando la tarjeta está completa aparece **Canjear premio**. Se pide confirmación y la tarjeta vuelve a empezar.
- El sistema no permite sellar dos veces al mismo cliente en poco tiempo (30 minutos por defecto; el dueño lo cambia).

### Para los dueños (`/entrar`)
- **Resumen:** clientes registrados, visitas, clientes que regresaron, premios canjeados y **ventas estimadas** (visitas de clientes que regresaron × ticket promedio, siempre marcadas como *estimado*). Incluye el reporte mensual con botón para compartirlo por WhatsApp, los clientes en riesgo y los últimos 6 meses.
- **Clientes:** búsqueda, botón de WhatsApp con mensaje prellenado (solo para clientes que aceptaron promociones) y **Exportar CSV**.
- **Mi tarjeta:** logo, colores (con revisión de contraste), icono, reglas y vista previa en vivo.
- **Empleados:** alta, cambio de PIN y desactivación.
- **Cartel QR:** PDF tamaño carta listo para imprimir.
- **Historial:** cada sello y canje con empleado, fecha y hora.

---

## 9. Seguridad y privacidad

Qué hace la app:

- **Separación entre negocios:** la base de datos usa *Row Level Security*. Un dueño solo puede leer filas de su negocio, y las pruebas automáticas lo verifican.
- **Antifraude en el servidor:**
  - Sellar, canjear y deshacer ocurren en funciones de la base de datos que verifican la sesión del empleado, el negocio, el estado (suspendido) y el tiempo mínimo entre sellos, con bloqueo de fila para que dos sellos simultáneos no pasen.
  - El QR del cliente es un código aleatorio: no contiene su nombre ni su teléfono, y por sí solo no sirve para sellar.
- **Historial completo:** cada sello, canje y "deshacer" queda registrado con empleado, fecha y hora.
- **Secretos protegidos:**
  - Los PIN se guardan cifrados (bcrypt) y el enlace de cada cliente se guarda solo como *hash*.
  - Ni el dueño puede leerlos.
  - Las llaves van en variables de entorno, nunca en el código.
- **Límites de intentos:**
  - PIN: 6 intentos por IP cada 15 minutos y 25 por negocio.
  - Registro: 10 por IP por hora.
  - Inicio de sesión: 10 cada 15 minutos.
  - Recuperación: 20 por hora.
- **Consentimientos:** se guarda la fecha y la **versión** de cada aceptación (aviso, términos y promociones), y también cada cambio posterior.
- **Baja:** borra nombre, teléfono y cumpleaños, y desactiva el enlace. Solo quedan visitas anónimas para los reportes.
- **Logos:**
  - Se aceptan PNG, JPG o SVG de hasta 1 MB, y se revisa el contenido real del archivo.
  - Los SVG con código, eventos o enlaces externos se rechazan.
  - Todo se convierte a PNG en el servidor.
- **Navegador:**
  - Las peticiones del sellado verifican el origen (protección CSRF).
  - Las páginas de tarjeta no se indexan en buscadores ni filtran su enlace a otros sitios.

**Pendiente de tu parte:**
- Revisión legal del aviso de privacidad y los términos. Edítalos en **Superadmin → Legal**: cada cambio crea una versión nueva. Cuando los apruebe un abogado, desmarca *Marcar como borrador*.
- Indicar en el aviso los datos de contacto del responsable (cada negocio).

---

## 10. Cobros (para después)

Esta versión **no cobra**. Cada negocio tiene un estado manual:

- **Prueba:** funciona completo y se muestra la fecha de fin de prueba.
- **Activo:** funciona completo.
- **Suspendido:** los clientes conservan sus datos y sellos, pero **no se pueden agregar sellos ni registrar clientes nuevos**. Los premios ya ganados sí se pueden canjear.

La tabla `businesses` ya incluye los campos `billing_provider` (`stripe` o `mercadopago`), `billing_customer_id`, `billing_subscription_id`, `billing_status` y `billing_current_period_end`. Para integrar pagos, un *webhook* de Stripe o Mercado Pago solo tendrá que actualizar esos campos y el `status`.

---

## 11. Pruebas

| Comando | Qué revisa |
|---|---|
| `npm test` | 42 pruebas: separación entre negocios (RLS), bloqueo de doble sello (incluso con sellos simultáneos), deshacer, canje y reinicio de tarjeta, premio intermedio, consentimiento y baja, duplicados por teléfono, límites de intentos, recuperación, reportes, y utilidades (teléfonos, contraste, CSV, logos). |
| `npm run e2e` | Recorrido completo en tamaño móvil (iPhone 13 y Pixel 7): registro, tarjeta, QR, sellado con cámara simulada, tiempo de sellado (< 2 s), animación, bloqueo, deshacer, promociones, baja, panel, CSV y PDF. |

- `npm test` necesita un **Postgres local** porque crea una base de pruebas desechable. Por defecto usa `postgres://postgres:postgres@127.0.0.1:5432/postgres`; puedes cambiarla con `TEST_PG_URL`. **Nunca** la apuntes a tu base real.
- `npm run e2e` necesita la app corriendo (`npm run dev`) y los datos de demo (`npm run demo`). Si tienes `ffmpeg`, simula la cámara con el QR real del cliente. Las capturas quedan en `test-results/`.

---

## 12. Desarrollo en tu computadora

```bash
npm install
```

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus llaves de Supabase (de un proyecto de pruebas, de preferencia) y luego:

```bash
npm run dev
```

Abre http://localhost:3000.

- Si cambias algo en `supabase/migrations/`, ejecuta `npm run sql:unir` para regenerar `supabase/instalar-todo.sql`.
- **Avanzado:** `scripts/local/stack.sh` levanta una copia local de Supabase (Postgres, Auth, REST y Storage) sin la nube. Se usó para las pruebas. Requiere Docker, Postgres 16 y el binario de Supabase Auth; para el uso normal no lo necesitas.

---

## 13. Solución de problemas

| Problema | Solución |
|---|---|
| La cámara no abre en la pantalla de sellado | La cámara solo funciona con `https://` (Vercel ya lo usa). En iPhone: **Ajustes → Safari → Cámara → Permitir**. En Android: candado junto a la dirección → **Permisos → Cámara**. Mientras tanto usa **Buscar teléfono**. |
| "Demasiados intentos" | Es el límite de seguridad. Espera 15 minutos (PIN o inicio de sesión) o 1 hora (registro). |
| El dueño olvidó su contraseña | **Superadmin → Editar negocio → Restablecer contraseña**. |
| Un empleado se fue | **Empleados → Desactivar**. Se cierran sus sesiones al instante. |
| Error "Falta la variable de entorno…" | Revisa las 5 variables en Vercel y vuelve a desplegar (**Redeploy**). |
| El QR del cartel no abre la página | Revisa que `NEXT_PUBLIC_APP_URL` sea tu dirección final y vuelve a descargar el PDF. |
| Cambié la dirección (slug) de un negocio | Los carteles impresos anteriores dejan de funcionar: imprime uno nuevo. |

---

## 14. Cómo está hecho

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS 4**, listo para Vercel.
- **Supabase:** Postgres con RLS, Auth (dueños y superadmin) y Storage (logos).
- **PWA:** manifest por negocio y por tarjeta, iconos generados con el logo, *service worker* mínimo y metadatos de Apple para iPhone.
- **Lectura de QR:** lector nativo del navegador en Android y `jsQR` en iPhone (Safari no trae lector nativo).

```
supabase/migrations/      Esquema, RLS, funciones (sellar, canjear, deshacer…), textos legales
supabase/instalar-todo.sql  Las migraciones unidas para pegar en Supabase
src/app/n/[slug]/         Página pública del negocio, registro, recuperación, legal
src/app/n/[slug]/staff    PIN del empleado · /sellar: escáner
src/app/t/[token]/        Tarjeta privada del cliente
src/app/r/[code]/         Recuperación de tarjeta (código de un solo uso)
src/app/panel/[id]/       Panel del dueño
src/app/admin/            Superadmin
src/app/api/              Sellado, tarjeta, CSV, PDF, iconos
src/lib/                  Utilidades (colores, teléfonos, PDF, logos, sesión…)
scripts/                  Demo, superadmin, utilidades
tests/                    Pruebas de reglas (db), utilidades (unit) y móvil (e2e)
```

**Reglas por defecto:** 8 sellos, 2 sellos de regalo al registrarse, 30 minutos entre sellos, cliente en riesgo tras 30 días sin visitar (si tenía 3 o más visitas). Todo es configurable por negocio.
