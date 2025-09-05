import { useEffect, useMemo, useRef, useState } from 'react'
import { Separator } from '@/components/ui/separator.jsx'
import { getCompanyInfo, getMapboxPublicKey } from '@/lib/api.ts'

function loadScriptOnce(src, id) {
  return new Promise((resolve, reject) => {
    if (id && document.getElementById(id)) return resolve()
    const s = document.createElement('script')
    if (id) s.id = id
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Falha ao carregar script: ' + src))
    document.head.appendChild(s)
  })
}

function loadCssOnce(href, id) {
  return new Promise((resolve, reject) => {
    if (id && document.getElementById(id)) return resolve()
    const l = document.createElement('link')
    if (id) l.id = id
    l.rel = 'stylesheet'
    l.href = href
    l.onload = () => resolve()
    l.onerror = () => reject(new Error('Falha ao carregar CSS: ' + href))
    document.head.appendChild(l)
  })
}

function getReadableTextColor(hex) {
  const c = (hex || '').toString()
  const m = c.match(/^#?([0-9a-f]{6})$/i)
  const base = m ? m[1] : '111827' // slate-900
  const r = parseInt(base.substr(0, 2), 16)
  const g = parseInt(base.substr(2, 2), 16)
  const b = parseInt(base.substr(4, 2), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 128 ? '#111827' : '#FFFFFF'
}

// Helpers adicionais: normalizar URL de imagem e construir link do WhatsApp
function normalizeImageUrl(url) {
  if (!url) return ''
  try {
    // Mantém URLs absolutas (http/https/data)
    if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:')) return url
    // Caso seja relativo, tenta resolver contra a origem atual
    return new URL(url, window.location.origin).toString()
  } catch (_) {
    return url
  }
}

function onlyDigits(str) {
  return (str || '').replace(/\D+/g, '')
}

function buildWhatsAppLink(phone) {
  const digits = onlyDigits(phone)
  // Se já começar com 55 (Brasil) e tiver 12-13+ dígitos, mantém; caso contrário, prefixa 55
  const normalized = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${normalized}`
}

export default function Footer() {
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mapboxKey, setMapboxKey] = useState(null)
  const mapRef = useRef(null)
  const mapInited = useRef(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const [info, key] = await Promise.all([
          getCompanyInfo().catch(() => null),
          getMapboxPublicKey().catch(() => null),
        ])
        if (!mounted) return
        setCompany(info)
        setMapboxKey(key)
      } catch (e) {
        if (!mounted) return
        setError(e?.message || 'Falha ao carregar informações da empresa')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const bgColor = company?.company_color || '#111827'
  const textColor = useMemo(() => getReadableTextColor(bgColor), [bgColor])

  useEffect(() => {
    if (mapInited.current) return
    if (!mapboxKey) return
    if (!company?.latitude || !company?.longitude) return
    if (!mapRef.current) return

    let cancelled = false

    ;(async () => {
      try {
        await loadCssOnce('https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css', 'mapbox-gl-css')
        await loadScriptOnce('https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js', 'mapbox-gl-js')
        if (cancelled) return
        if (!window.mapboxgl) throw new Error('Mapbox GL não disponível')
        window.mapboxgl.accessToken = mapboxKey
        const center = [Number(company.longitude), Number(company.latitude)]
        const map = new window.mapboxgl.Map({
          container: mapRef.current,
          style: 'mapbox://styles/mapbox/streets-v11',
          center,
          zoom: 14,
          cooperativeGestures: true,
        })
        new window.mapboxgl.Marker().setLngLat(center).addTo(map)
        mapInited.current = true
      } catch (e) {
        // Silenciar erro no footer; apenas não mostrar o mapa
        // console.error(e)
      }
    })()

    return () => { cancelled = true }
  }, [mapboxKey, company])

  if (loading) return null
  if (!company) return null

  return (
    <footer
      className="mt-8"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <div className="md:col-span-2 space-y-2">
            {/* Logo + Nome */}
            <div className="flex items-center gap-3">
              {company.logo_url && (
                <img
                  src={normalizeImageUrl(company.logo_url)}
                  alt={company.company_name ? `${company.company_name} logo` : 'Logo'}
                  className="h-10 w-auto object-contain drop-shadow"
                  loading="lazy"
                />
              )}
              <div>
                <div className="text-xl font-semibold">{company.company_name || 'Nossa Empresa'}</div>
                {company.cnpj && (
                  <div className="text-sm opacity-90">CNPJ: {company.cnpj}</div>
                )}
              </div>
            </div>

            {/* Endereço */}
            {company.address && (
              <div className="text-sm opacity-90">{company.address}</div>
            )}
            {company.zip_code && (
              <div className="text-sm opacity-90">CEP: {company.zip_code}</div>
            )}

            {/* WhatsApp */}
            {company.phone && (
              <div className="text-sm opacity-90">
                <a
                  href={buildWhatsAppLink(company.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                  style={{ color: textColor }}
                >
                  WhatsApp: {company.phone}
                </a>
              </div>
            )}
          </div>

          {/* Mapa ou link para Google Maps */}
          <div>
            {mapboxKey && company?.latitude && company?.longitude ? (
              <div
                ref={mapRef}
                className="h-40 w-full rounded-md overflow-hidden border border-white/10"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              />
            ) : (
              <div className="text-sm opacity-80">
                {company.latitude && company.longitude ? (
                  <a
                    className="underline"
                    style={{ color: textColor }}
                    target="_blank"
                    href={`https://www.google.com/maps?q=${encodeURIComponent(company.latitude + ',' + company.longitude)}`}
                    rel="noreferrer"
                  >
                    Ver no mapa
                  </a>
                ) : (
                  <span>Localização não disponível</span>
                )}
              </div>
            )}
          </div>
        </div>

        <Separator className="my-6 opacity-20" />

        <div className="text-xs opacity-80 flex flex-col sm:flex-row justify-between gap-2">
          <div>
            © {new Date().getFullYear()} {company.company_name || 'Empresa'}. Todos os direitos reservados.
          </div>
          <div>
            Feito com ❤
          </div>
        </div>
      </div>
    </footer>
  )
}