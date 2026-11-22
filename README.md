# Cotizador Mauli

App web para crear cotizaciones y generarlas en PDF. Funciona sin internet y sin instalar nada.

## Cómo usar
1. Abre `index.html` en el navegador (PC o celular).
2. Llena: cliente, materiales, productos (medidas × precio por metro), tiempo de entrega, garantía.
3. Agrega imágenes de referencia del trabajo.
4. **Descargar PDF** → baja el archivo listo para enviar.
   **Imprimir** → alternativa: "Guardar como PDF" desde el navegador.

## Qué se puede editar
- Nombre, dirección y teléfono del cliente, fecha y N° de cotización.
- Descripción de materiales (agregar / quitar filas).
- Productos: nombre, cantidad, descripción, medidas, unidad, precio por metro. El total se calcula solo.
- Anticipo (%), tiempo estimado de entrega, validez, garantía y observaciones.
- Imágenes de referencia con pie de foto.
- Datos de la empresa y logo (se guardan para siempre).

## Guardado
- Todo se guarda automáticamente en el navegador.
- **Guardar** agrega la cotización a "Guardadas" (abrir, duplicar, borrar).
- **Exportar respaldo** descarga un `.json` para pasarlo a otro dispositivo.

## Archivos
- `index.html`, `styles.css`, `app.js` — la app.
- `logo.js` — logo por defecto embebido.
- `vendor/html2pdf.bundle.min.js` — librería para crear el PDF (MIT).
