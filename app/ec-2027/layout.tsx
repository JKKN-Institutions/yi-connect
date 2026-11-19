import type { Metadata, Viewport } from 'next'
import './eoi.css'

export const metadata: Metadata = {
  title: { absolute: 'Yi Erode · Enablers of Change (EC) 2027 · Expression of Interest' },
  description: 'Express your interest in joining the Yi Erode Enablers of Change (EC) 2027.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = { themeColor: '#146348' }

export default function EcEoiLayout({ children }: { children: React.ReactNode }) {
  return <div className="eoi-root">{children}</div>
}
