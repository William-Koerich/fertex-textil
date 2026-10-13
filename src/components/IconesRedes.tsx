import type { SVGProps } from 'react'
import { Globe, Link2, MessageCircle } from 'lucide-react'
import type { Origem } from '@/lib/visitas'

// Ícones das redes no mesmo estilo de traço dos ícones do lucide (que não traz marcas na v1)
const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function IconeInstagram(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

export function IconeFacebook(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}

export function IconeOrigem({ origem, className }: { origem: Origem; className?: string }) {
  const p = { className, 'aria-hidden': true }
  switch (origem) {
    case 'instagram':
      return <IconeInstagram {...p} />
    case 'facebook':
      return <IconeFacebook {...p} />
    case 'whatsapp':
      return <MessageCircle {...p} />
    case 'direto':
      return <Link2 {...p} />
    default:
      return <Globe {...p} />
  }
}
