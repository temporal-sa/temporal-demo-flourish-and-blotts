import { useEffect, useState } from 'react'
import Storefront from './pages/Storefront'
import OpsDashboard from './pages/OpsDashboard'
import OrderStatus from './pages/OrderStatus'

type Page =
  | { name: 'storefront' }
  | { name: 'ops' }
  | { name: 'order'; orderId: string }

function parseLocation(): Page {
  const m = window.location.pathname.match(/^\/orders\/([^/]+)/)
  if (m) return { name: 'order', orderId: decodeURIComponent(m[1]) }
  if (window.location.pathname.startsWith('/ops')) return { name: 'ops' }
  return { name: 'storefront' }
}

export default function App() {
  const [page, setPage] = useState<Page>(() => parseLocation())

  useEffect(() => {
    const onPop = () => setPage(parseLocation())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function navigate(p: Page, path: string) {
    window.history.pushState({}, '', path)
    setPage(p)
  }

  const goShop = () => navigate({ name: 'storefront' }, '/')
  const goOps = () => navigate({ name: 'ops' }, '/ops')
  const goOrder = (orderId: string) => navigate({ name: 'order', orderId }, `/orders/${orderId}`)

  return (
    <div className="app-shell">
      <div className="site-ribbon">
        Fine books · Rare volumes · Questionably tame bestsellers
      </div>
      <header className="site-header">
        <div className="site-header-inner">
          <button onClick={goShop} className="brand-lockup" aria-label="Flourish and Blotts home">
            <span className="brand-seal" aria-hidden="true">F<span>&amp;</span>B</span>
            <span className="brand-copy">
              <span className="brand-name">Flourish <i>&amp;</i> Blotts</span>
              <span className="brand-tagline">Purveyors of magical literature since 1734</span>
            </span>
          </button>
          <nav className="site-nav" aria-label="Primary navigation">
            <button
              onClick={goShop}
              className={`site-nav-button${page.name === 'storefront' ? ' site-nav-button--active' : ''}`}
              aria-current={page.name === 'storefront' ? 'page' : undefined}
            >
              <span aria-hidden="true">❧</span> Bookshop
            </button>
            <button
              onClick={goOps}
              className={`site-nav-button${page.name === 'ops' ? ' site-nav-button--active' : ''}`}
              aria-current={page.name === 'ops' ? 'page' : undefined}
            >
              <span aria-hidden="true">✦</span> Order operations
            </button>
          </nav>
        </div>
      </header>

      <main>
        {page.name === 'storefront' && <Storefront onTrackOrder={goOrder} />}
        {page.name === 'ops' && <OpsDashboard />}
        {page.name === 'order' && <OrderStatus orderId={page.orderId} onBack={goShop} />}
      </main>
    </div>
  )
}
