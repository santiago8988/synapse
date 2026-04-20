'use client'

import { BrainMark } from '@/components/brand/brain-mark'

export default function LoginPage() {
  const handleGoogleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-0)' }}>
      {/* Panel izquierdo — Branding oscuro */}
      <div
        className="hidden w-1/2 flex-col justify-between p-12 lg:flex"
        style={{ background: 'var(--bg-sidebar)' }}
      >
        <div className="relative">
          <div
            className="absolute inset-0 -z-10 synapse-grid-bg opacity-[0.08]"
            style={{ maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)' }}
          />
          <div className="flex items-center gap-3">
            <BrainMark size={44} animated />
            <div className="flex flex-col leading-none">
              <span
                className="text-[28px] tracking-tight text-white"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                Synap<em className="italic" style={{ color: 'var(--brand-cian)' }}>se</em>
              </span>
              <span
                className="mt-1 text-[10px] uppercase tracking-[0.24em]"
                style={{ fontFamily: 'var(--font-mono)', color: '#6A7797' }}
              >
                by · NosisHub
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="kicker" style={{ color: 'rgba(94,234,254,0.7)' }}>
            · La inteligencia detrás de la calidad
          </div>
          <h1 className="text-[44px] font-[400] leading-[1.08] tracking-tight text-white">
            Gestión de calidad,{' '}
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--brand-cian)' }}>
              en sinapsis.
            </span>
          </h1>
          <p className="max-w-md text-[15px] leading-relaxed" style={{ color: '#A9B4CC' }}>
            Trazabilidad completa de ensayos, calibraciones e instrumental. Configurable al detalle, auditable de extremo a extremo.
          </p>

          <div className="flex gap-8 pt-4">
            {[
              { big: 'ISO', small: '9001 · 17025' },
              { big: '100%', small: 'Trazabilidad' },
              { big: 'PWA', small: 'Mobile-first' },
            ].map((item, i, arr) => (
              <div key={item.big} className="flex items-center gap-8">
                <div>
                  <p
                    className="text-[32px] text-white"
                    style={{ fontFamily: 'var(--font-serif)' }}
                  >
                    {item.big}
                  </p>
                  <p
                    className="text-[10px] uppercase tracking-[0.18em]"
                    style={{ fontFamily: 'var(--font-mono)', color: '#6A7797' }}
                  >
                    {item.small}
                  </p>
                </div>
                {i < arr.length - 1 && <div className="h-10 w-px bg-white/10" />}
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px]" style={{ color: '#4E5977', fontFamily: 'var(--font-mono)' }}>
          &copy; {new Date().getFullYear()} NosisHub · Synapse.
        </p>
      </div>

      {/* Panel derecho — Login */}
      <div className="flex w-full flex-col items-center justify-center px-8 lg:w-1/2">
        <div className="w-full max-w-sm space-y-8">
          {/* Brand mobile */}
          <div className="flex flex-col items-center gap-2 lg:hidden">
            <BrainMark size={48} animated />
            <span
              className="text-[22px]"
              style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-0)' }}
            >
              Synap<em className="italic" style={{ color: 'var(--accent-live)' }}>se</em>
            </span>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <div className="kicker">· Acceso</div>
            <h2
              className="text-[32px] tracking-tight"
              style={{ color: 'var(--ink-0)', fontFamily: 'var(--font-serif)' }}
            >
              Bienvenido,{' '}
              <em className="italic" style={{ color: 'var(--primary-hex)' }}>
                iniciá sesión.
              </em>
            </h2>
            <p className="text-[14px]" style={{ color: 'var(--ink-2)' }}>
              Sólo emails autorizados por el admin de tu organización pueden entrar.
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="group flex w-full items-center justify-center gap-3 rounded-xl border px-6 py-3.5 text-sm font-medium transition-all hover:shadow-md"
            style={{
              borderColor: 'var(--line-2)',
              background: 'var(--bg-1)',
              color: 'var(--ink-0)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span>Continuar con Google</span>
          </button>

          <div className="space-y-3 rounded-[10px] p-4" style={{ background: 'var(--bg-3)' }}>
            <p
              className="text-[10px] uppercase tracking-[0.18em]"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}
            >
              Acceso solo por invitación
            </p>
            <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
              Tu email debe estar autorizado por el administrador de tu organización antes de poder iniciar sesión.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
