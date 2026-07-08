import React, { useEffect, useRef, useState } from 'react'

const COLOR = '#7C3AED'
const SCANNER_ID = 'barcode-scanner-region'

// Maps an Open Food Facts product to our food shape.
function mapProduct(product) {
  const n = product.nutriments || {}
  const perServing = n['energy-kcal_serving']
  const per100 = n['energy-kcal_100g']
  const useServing = perServing != null && perServing !== ''
  const pick = (base) => {
    const s = n[`${base}_serving`]
    const h = n[`${base}_100g`]
    if (useServing && s != null && s !== '') return Number(s)
    if (h != null && h !== '') return Number(h)
    return 0
  }
  const cal = useServing ? Number(perServing) : Number(per100 || 0)
  return {
    name: product.product_name || product.generic_name || 'Scanned product',
    cal: Math.round(cal || 0),
    p: Math.round(pick('proteins') || 0),
    c: Math.round(pick('carbohydrates') || 0),
    f: Math.round(pick('fat') || 0),
    serving: useServing
      ? (product.serving_size ? `per serving (${product.serving_size})` : 'per serving')
      : 'per 100g',
  }
}

export default function BarcodeScanner({ onFound, onClose }) {
  const scannerRef = useRef(null)
  const activeRef = useRef(false)
  const [status, setStatus] = useState('starting') // starting | scanning | error | looking-up
  const [message, setMessage] = useState('')
  const [manual, setManual] = useState('')

  async function lookup(barcode) {
    const code = String(barcode || '').trim()
    if (!code) return
    setStatus('looking-up')
    setMessage(`Looking up ${code}…`)
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`)
      const data = await res.json()
      if (data && data.status === 1 && data.product) {
        const food = mapProduct(data.product)
        if (typeof onFound === 'function') onFound(food)
      } else {
        setStatus('error')
        setMessage(`No product found for ${code}. Try manual entry or add a custom food.`)
      }
    } catch (e) {
      setStatus('error')
      setMessage('Could not reach the food database. Check your connection or add manually.')
    }
  }

  useEffect(() => {
    let cancelled = false

    async function start() {
      if (typeof window === 'undefined') return
      try {
        const mod = await import('html5-qrcode')
        if (cancelled) return
        const Html5Qrcode = mod.Html5Qrcode
        const formatsMod = mod.Html5QrcodeSupportedFormats
        const el = document.getElementById(SCANNER_ID)
        if (!el) return
        const scanner = new Html5Qrcode(SCANNER_ID, {
          verbose: false,
          formatsToSupport: formatsMod
            ? [
                formatsMod.EAN_13,
                formatsMod.EAN_8,
                formatsMod.UPC_A,
                formatsMod.UPC_E,
                formatsMod.CODE_128,
              ]
            : undefined,
        })
        scannerRef.current = scanner
        activeRef.current = true
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            if (!activeRef.current) return
            activeRef.current = false
            stop().finally(() => lookup(decodedText))
          },
          () => {} // per-frame decode failure — ignore
        )
        if (!cancelled) {
          setStatus('scanning')
          setMessage('')
        }
      } catch (e) {
        if (cancelled) return
        setStatus('error')
        setMessage(
          'Camera unavailable or permission denied. Enter the barcode number below instead.'
        )
      }
    }

    start()

    return () => {
      cancelled = true
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function stop() {
    activeRef.current = false
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return
    try {
      if (typeof scanner.getState === 'function') {
        // 2 === SCANNING in html5-qrcode
      }
      await scanner.stop()
    } catch (e) {
      /* already stopped */
    }
    try {
      await scanner.clear()
    } catch (e) {
      /* ignore */
    }
  }

  return (
    <div className="space-y-4">
      <div
        id={SCANNER_ID}
        className="w-full rounded-2xl overflow-hidden bg-black/50 border border-white/10"
        style={{ minHeight: status === 'error' ? 0 : 220 }}
      />

      {status === 'starting' && (
        <p className="text-sm text-white/50 text-center">Starting camera…</p>
      )}
      {status === 'scanning' && (
        <p className="text-sm text-white/50 text-center">Point the camera at a barcode.</p>
      )}
      {status === 'looking-up' && (
        <p className="text-sm text-white/60 text-center">{message}</p>
      )}
      {status === 'error' && message && (
        <p className="text-sm text-center" style={{ color: '#F59E0B' }}>{message}</p>
      )}

      <div>
        <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-widest">
          Enter barcode manually
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="e.g. 9310072011691"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm"
            style={{ outline: 'none' }}
          />
          <button
            type="button"
            onClick={() => lookup(manual)}
            className="btn-press px-4 rounded-xl font-bold text-white text-sm"
            style={{ background: COLOR }}
          >
            Look up
          </button>
        </div>
      </div>

      {typeof onClose === 'function' && (
        <button
          type="button"
          onClick={() => { stop().finally(onClose) }}
          className="btn-press w-full py-2.5 rounded-xl font-semibold text-white/60 text-sm bg-white/5 border border-white/10"
        >
          Cancel
        </button>
      )}
    </div>
  )
}
