# AGENTS.md - Guía de Desarrollo de Open Lovable

## Descripción del Proyecto

Open Lovable es una aplicación Next.js 15 para generación de aplicaciones React con IA. Utiliza Turbopack, Tailwind CSS, componentes Radix UI y soporta múltiples proveedores de IA (Anthropic, OpenAI, Google, Groq).

## Comandos de Desarrollo

### Comandos Principales
```bash
pnpm dev          # Iniciar servidor de desarrollo con Turbopack (http://localhost:3000)
pnpm build        # Compilación de producción
pnpm start        # Iniciar servidor de producción
pnpm lint         # Ejecutar ESLint
```

### Comandos de Pruebas
```bash
pnpm test:api           # Ejecutar pruebas de endpoints de API
pnpm test:code          # Ejecutar pruebas de ejecución de código
pnpm test:all           # Ejecutar todas las pruebas (integración + API + código)
```

### Ejecutar una Sola Prueba
Las pruebas son scripts plain de Node.js (no Jest/Vitest):
```bash
node tests/api-endpoints.test.js
node tests/code-execution.test.js
```

## Guías de Estilo de Código

### Configuración de TypeScript
- **Modo estricto habilitado** - Sin any implícito, verificación estricta de nulos
- **Alias de rutas**: `@/*` mapea al raíz del proyecto
- **Preservar JSX** para Next.js
- Objetivo: ES2017

### Importaciones
- Usar alias de rutas: `import { cn } from "@/lib/utils"`
- Ordenar importaciones lógicamente (React primero, luego libs externas, luego internas)
- Preferir importaciones nombradas para tree-shaking: `import { useState } from "react"`

### Convenciones de Nomenclatura
- **Componentes**: PascalCase (`Button.tsx`, `HeroSection.tsx`)
- **Hooks**: camelCase con prefijo `use` (`useDebouncedCallback.ts`)
- **Utilidades**: camelCase (`cn.ts`, `sleep.ts`)
- **Tipos/Interfaces**: PascalCase, usualmente en directorio `types/` separado
- **Rutas API**: kebab-case (`apply-ai-code/route.ts`)

### Organización de Archivos
```
app/                    # Páginas y rutas API de Next.js App Router
  api/                  # Rutas API (un archivo por endpoint)
  builder/              # Componentes de página
  landing.tsx           # Página de destino
components/
  ui/                   # Componentes UI base (button, input, etc.)
  shared/               # Componentes compartidos
  app/                  # Componentes específicos de funcionalidad
lib/                    # Funciones utilitarias y helpers
hooks/                  # React hooks personalizados
types/                  # Definiciones de tipos TypeScript
utils/                  # Funciones utilitarias puras
config/                 # Archivos de configuración
```

### Patrones de Componentes

**Componentes UI (basados en Radix)**:
```typescript
// Usar class-variance-authority para variantes
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva("clases base", {
  variants: { variant: {...}, size: {...} },
  defaultVariants: { variant: "default", size: "default" }
})

// Usar patrón forwardRef
const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn("clases", className)} {...props} />
  }
)
Component.displayName = "ComponentName"
```

**Componentes de Cliente**: Agregar directiva `"use client"` al inicio de archivos del lado del cliente.

### Manejo de Errores
- Usar try/catch con manejo de errores específico
- Registrar errores con contexto descriptivo: `console.error('[route] Error message:', error)`
- Retornar códigos de estado HTTP apropiados en rutas API
- Usar `NextResponse.json()` para respuestas de API

### Estilos
- **Solo Tailwind CSS** - Sin estilos inline, sin archivos CSS excepto `index.css`
- Usar variables CSS vía `hsl(var(--variable))`
- Colores personalizados vía Tailwind config: `text-primary`, `bg-secondary`
- Usar utilitario `cn()` para clases condicionales: `cn("base", condition && "agregado")`
- Preferir clases Tailwind estándar sobre CSS personalizado

### Patrón de Rutas API
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    // ... lógica
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[route] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Mensaje' },
      { status: 500 }
    );
  }
}
```

### Gestión de Estado
- Usar Jotai para estado global (`@/atoms/`)
- React hooks para estado local
- Session storage para datos temporales entre páginas

### Reglas de ESLint
- `@typescript-eslint/no-explicit-any`: OFF (any permitido)
- `@typescript-eslint/no-unused-vars`: OFF
- `react-hooks/exhaustive-deps`: WARN
- `prefer-const`: WARN
- Entidades sin escapar permitidas en JSX

### Dependencias Clave
- **UI**: Radix UI, Framer Motion, Lucide React
- **IA**: Vercel AI SDK, Anthropic, OpenAI, Google, Groq
- **Sandbox**: E2B Code Interpreter, Vercel Sandbox
- **Scraping**: Playwright (nuestro scraper), Cheerio, Firecrawl (opcional)
- **Datos**: Zod (validación), jotai (estado)
- **Estilos**: Tailwind CSS 3.4, class-variance-authority

### Sistema de Scraping
El proyecto tiene un sistema de scraping configurable que soporta múltiples proveedores:

#### Proveedores disponibles:
| Proveedor | Descripción | Costo |
|-----------|-------------|-------|
| `opencode` | Playwright-based (default) | Gratis |
| `firecrawl` | API de Firecrawl | $15+/mes |

#### Configuración:
```env
SCRAPER_PROVIDER=opencode  # Valor por defecto
```

#### API de Scraping:
```typescript
// lib/scrapers/index.ts exports
import { scrape, getScraperProvider } from '@/lib/scrapers';

// Uso
const result = await scrape(url, {
  formats: ['markdown', 'html', 'screenshot'],
  waitFor: 2000,
});
// result.provider = 'opencode' | 'firecrawl'
```

#### Endpoints:
- `POST /api/scrape-opencode` - Scraper principal
- `POST /api/scrape-website` - Alias compatible
- `POST /api/scrape-url-enhanced` - Con formato optimizado para IA
- `POST /api/scrape-screenshot` - Solo screenshot

### Pruebas
Las pruebas son scripts JavaScript plain usando módulos nativos de Node.js. Se pueden ejecutar directamente con `node`.

### Variables de Entorno
Requeridas:
- Clave de Proveedor de IA (una de): `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`

Opcionales:
- `SCRAPER_PROVIDER` - Proveedor de scraping (`opencode` default, `firecrawl` para sitios difíciles)
- `FIRECRAWL_API_KEY` - Solo si usas `SCRAPER_PROVIDER=firecrawl`
- `MORPH_API_KEY` - Modo de aplicación rápida
- `E2B_API_KEY` - Proveedor de sandbox alternativo
- `AI_GATEWAY_API_KEY` - Vercel AI Gateway

Ver `.env.example` para lista completa.

### Verificaciones Pre-commit
Ejecutar antes de hacer commit:
```bash
pnpm lint
pnpm build  # Verificar compilación de producción
```
