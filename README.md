# Cuentos Personalizados

Una aplicación web que genera cuentos infantiles personalizados con imágenes generadas por IA.

## Características

- Generación de cuentos personalizados con el nombre del niño
- Selección de temas y estilos de ilustración
- Generación de imágenes con DALL-E 3
- Vista previa de la portada y la primera página
- Preparado para implementar pasarela de pago (en desarrollo)

## Tecnologías

- Next.js
- Tailwind CSS
- OpenAI GPT-4o para generación de historias
- DALL-E 3 para generación de imágenes

## Configuración

1. Clona este repositorio
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Crea un archivo `.env.local` en la raíz del proyecto con tu clave API de OpenAI:
   ```
   OPENAI_API_KEY=tu_clave_api_de_openai
   ```
4. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
5. Abre [http://localhost:3000](http://localhost:3000) en tu navegador

## Estructura del Proyecto

- `app/page.js` - Página principal
- `app/components/BookGenerationForm.js` - Formulario para la generación de cuentos
- `app/api/story/generate/route.js` - API para generar historias con GPT-4o
- `app/api/image/generate/route.js` - API para generar imágenes con DALL-E 3
- `public/stories/` - Directorio donde se guardan las imágenes generadas

## Próximas Funcionalidades

- Integración de pasarela de pago (Bold.co / MercadoPago)
- Panel de administración
- Generación de PDF completo
- Opción para imprimir libros físicos
