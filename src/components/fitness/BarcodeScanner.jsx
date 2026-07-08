import React, { useCallback, useEffect, useRef, useState } from 'react'

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
  const mountedRef = useRef(true)
  const [status, setStatus] = useState('initializing') // initializing | scanning | error | looking-up
  const [message, setMessage] = useState('')
  const [manual, setManual] = useState('')
  const [attempt, setAttempt] = useState(0)

  const stop = useCallback(async () => {
    activeRef.current = false
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return
    try {
      await scanner.stop()
    } catch (e) {
      /* already stopped / never started */
    }
    try {
      await scanner.clear()
    } catch (e) {
      /* ignore */
    }
  }, [])

  const lookup = useCallback(async (barcode) => {
    const code = String(barcode || '').trim()
    if (!code) return
    await stop()
    if (!mountedRef.current) return
    setStatus('looking-up')
    setMessage(`Looking up ${code}…`)
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`)
      const data = await res.json()
      if (!mountedRef.current) return
      if (data && data.status === 1 && data.product) {
        const food = mapProduct(data.product)
        if (typeof onFound === 'function') onFound(food)
      } else {
        setStatus('error')
        setMessage(`No product found for ${code}. Try manual entry or add a custom food.`)
      }
    } catch (e) {
      if (!mountedRef.current) return
      setStatus('error')
      setMessage('Could not reach the food database. Check your connection or add manually.')
    }
  }, [onFound, stop])

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false

    async function start() {
      if (typeof window === 'undefined') return
      setStatus('initializing')
      setMessage('')
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
        // qrbox sized to fit inside the container (square, padded).
        const qrboxFn = (vw, vh) => {
          const edge = Math.max(120, Math.floor(Math.min(vw, vh) * 0.7))
          return { width: edge, height: Math.floor(edge * 0.62) }
        }
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: qrboxFn, aspectRatio: 1.0 },
          (decodedText) => {
            if (!activeRef.current) return
            activeRef.current = false
            lookup(decodedText)
          },
          () => {} // per-frame decode failure — ignore
        )
        if (cancelled) {
          // component closed during async start — release camera immediately
          stop()
          return
        }
        setStatus('scanning')
        setMessage('')
      } catch (e) {
        if (cancelled) return
        setStatus('error')
        setMessage('Camera unavailable or permission denied. Retry, or enter the barcode number below.')
      }
    }

    start()

    return () => {
      cancelled = true
      mountedRef.current = false
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  function handleClose() {
    stop().finally(() => {
      if (typeof onClose === 'function') onClose()
    })
  }

  return (
    <div className="space-y-4">
      {/* Header with close */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white">Scan a barcode</span>
        {typeof onClose === 'function' && (
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close scanner"
            className="btn-press w-8 h-8 rounded-full flex items-center justify-center text-white/70 bg-white/5 border border-white/10"
          >
            ✕
          </button>
        )}
      </div>

      {/* Camera container: fixed, responsive, nothing overflows */}
      <div
        className="relative mx-auto w-full rounded-2xl overflow-hidden bg-black/60 border border-white/10"
        style={{ height: 'min(70vh, 400px)' }}
      >
        <div id={SCANNER_ID} className="absolute inset-0 w-full h-full" />

        {(status === 'initializing' || status === 'looking-up') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
            <div
              className="w-8 h-8 rounded-full border-2 border-white/20 animate-spin"
              style={{ borderTopColor: COLOR }}
            />
            <p className="text-sm text-white/60">
              {status === 'looking-up' ? message : 'Starting camera…'}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <p className="text-sm" style={{ color: '#F59E0B' }}>{message}</p>
            <button
              type="button"
              onClick={() => setAttempt((a) => a + 1)}
              className="btn-press px-5 py-2 rounded-xl font-bold text-white text-sm"
              style={{ background: COLOR, boxShadow: `0 0 20px ${COLOR}50` }}
            >
              Retry camera
            </button>
          </div>
        )}
      </div>

      {status === 'scanning' && (
        <p className="text-xs text-white/50 text-center">Point the rear camera at a barcode.</p>
      )}

      {/* Manual fallback — always available */}
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
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), lookup(manual))}
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
          onClick={handleClose}
          className="btn-press w-full py-2.5 rounded-xl font-semibold text-white/60 text-sm bg-white/5 border border-white/10"
        >
          Cancel
        </button>
      )}
    </div>
  )
}
