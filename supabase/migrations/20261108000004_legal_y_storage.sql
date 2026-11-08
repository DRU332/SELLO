-- =====================================================================
-- Sellos · Documentos legales iniciales (BORRADOR) y bucket de logos
-- IMPORTANTE: estos textos son un borrador y deben ser revisados por un
-- abogado antes de usarse con clientes reales.
-- {{negocio}} se reemplaza por el nombre de cada negocio al mostrarse.
-- =====================================================================

insert into public.legal_documents (kind, version, title, body, is_draft) values
('privacy', '2026-11-08.1', 'Aviso de privacidad', $txt$
## Responsable
{{negocio}} (en adelante, "el Negocio") es responsable del tratamiento de tus datos personales recabados a través de su tarjeta de lealtad digital. La plataforma Sellos actúa como encargada y trata los datos únicamente por cuenta del Negocio.

## Datos que recabamos
- Nombre.
- Número de WhatsApp (teléfono celular).
- Fecha de cumpleaños (opcional).
- Registro de visitas, sellos y premios canjeados, con fecha y hora.

No recabamos datos personales sensibles.

## Finalidades necesarias
- Crear y administrar tu tarjeta de lealtad.
- Registrar tus visitas, sellos y premios.
- Evitar registros duplicados y usos indebidos de la promoción.
- Permitirte recuperar tu tarjeta.

## Finalidades opcionales
Solo si marcas la casilla correspondiente:
- Enviarte promociones, avisos de premios y felicitaciones de cumpleaños por WhatsApp.

Puedes retirar este consentimiento en cualquier momento desde tu tarjeta, sin que afecte tus sellos.

## Transferencias
No vendemos ni transferimos tus datos a terceros, salvo a proveedores tecnológicos que nos ayudan a operar el servicio (alojamiento y base de datos) y que están obligados a proteger tu información, o cuando lo exija una autoridad competente.

## Derechos ARCO y revocación
Puedes acceder, rectificar, cancelar u oponerte al tratamiento de tus datos, así como revocar tu consentimiento. Desde tu tarjeta puedes dejar de recibir promociones o dar de baja tu cuenta. Para otras solicitudes, acude al mostrador del Negocio o utiliza el medio de contacto que el Negocio indique.

## Conservación
Conservamos tus datos mientras tengas una tarjeta activa. Si das de baja tu cuenta, eliminamos tu nombre, teléfono y cumpleaños; solo conservamos registros anónimos de visitas con fines estadísticos.

## Cambios a este aviso
Cualquier cambio se publicará en esta misma página con una nueva versión y fecha.
$txt$, true),
('terms', '2026-11-08.1', 'Términos y condiciones', $txt$
## La tarjeta
La tarjeta de lealtad de {{negocio}} es gratuita, personal e intransferible. Funciona con un enlace privado: no lo compartas.

## Sellos
- Recibes sellos al hacer una compra, cuando el personal escanea tu código en el mostrador.
- Solo el personal del Negocio puede agregar sellos.
- Hay un tiempo mínimo entre sellos para el mismo cliente, indicado en tu tarjeta.
- Los sellos de regalo por registrarte no tienen valor en efectivo.

## Premios
- Al completar tu tarjeta puedes canjear el premio indicado. Después del canje la tarjeta vuelve a empezar.
- Los premios no son canjeables por dinero ni acumulables con otras promociones, salvo que el Negocio indique lo contrario.
- Aplican las condiciones, restricciones y vigencia que se muestran en la tarjeta.

## Uso indebido
El Negocio puede anular sellos o tarjetas obtenidos de forma fraudulenta.

## Suspensión del programa
El Negocio puede modificar o terminar la promoción. Si eso pasa, tus datos se conservan conforme al aviso de privacidad.

## Contacto
Para cualquier aclaración acude al mostrador de {{negocio}}.
$txt$, true);

-- Bucket público de logos (solo el servidor sube archivos, ya procesados a PNG)
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('logos', 'logos', true, 1048576, array['image/png'])
    on conflict (id) do nothing;
  end if;
end $$;
