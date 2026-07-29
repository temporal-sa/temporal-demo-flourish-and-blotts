import { useState, useEffect } from 'react'
import type { Book, CartItem } from '../types'
import { fetchCatalog } from '../api'
import BookCard from '../components/BookCard'
import Cart from '../components/Cart'
import CheckoutModal from '../components/CheckoutModal'

interface Props {
  onTrackOrder: (orderId: string) => void
}

const FILTERS = [
  { value: 'all', label: 'All shelves' },
  { value: 'standard', label: 'School texts' },
  { value: 'dangerous', label: 'Dangerous' },
  { value: 'restricted', label: 'Restricted' },
] as const

export default function Storefront({ onTrackOrder }: Props) {
  const [books, setBooks] = useState<Book[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCheckout, setShowCheckout] = useState(false)
  const [confirmation, setConfirmation] = useState<{ orderId: string; temporalUrl: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'standard' | 'restricted' | 'dangerous'>('all')

  useEffect(() => {
    fetchCatalog()
      .then(setBooks)
      .finally(() => setLoading(false))
  }, [])

  function addToCart(book: Book) {
    setCart(prev => {
      const existing = prev.find(i => i.book.id === book.id)
      if (existing) {
        return prev.map(i => i.book.id === book.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { book, quantity: 1 }]
    })
  }

  function removeFromCart(bookId: string) {
    setCart(prev => prev.filter(i => i.book.id !== bookId))
  }

  function handleOrderSuccess(orderId: string, temporalUrl: string) {
    setConfirmation({ orderId, temporalUrl })
    setCart([])
    setShowCheckout(false)
  }

  const filtered = filter === 'all' ? books : books.filter(b => b.category === filter)

  return (
    <div className="storefront-page">
      <section className="catalog-hero" aria-labelledby="catalog-hero-title">
        <div className="hero-spark hero-spark--one" aria-hidden="true">✦</div>
        <div className="hero-spark hero-spark--two" aria-hidden="true">·</div>
        <div className="catalog-hero-copy">
          <p className="hero-eyebrow">Diagon Alley · London</p>
          <h2 id="catalog-hero-title">A little magic<br />for every shelf.</h2>
          <p className="hero-intro">
            Browse schoolroom essentials, spellbound curiosities, and closely guarded
            volumes from the wizarding world’s most storied bookseller.
          </p>
          <div className="hero-promises" aria-label="Shop services">
            <span><strong>1734</strong> Established</span>
            <span><strong>Worldwide</strong> Owl post</span>
            <span><strong>Expert</strong> Curation</span>
          </div>
        </div>
        <div className="hero-notice">
          <div className="hero-notice-pin" aria-hidden="true" />
          <p className="hero-notice-kicker">Today’s shop notice</p>
          <h3>Mind the third shelf.</h3>
          <p>The Monster Book shipment is restless. Please stroke the spine before opening.</p>
          <div className="hero-notice-signoff">— The Management</div>
        </div>
      </section>

      {confirmation && (
        <div className="order-confirmation" role="status" aria-live="polite">
          <div>
            <p className="order-confirmation-title">Your order is on the move.</p>
            <p>Order {confirmation.orderId} is now being processed by the Temporal OMS.</p>
          </div>
          <div className="order-confirmation-actions">
            <button
              onClick={() => onTrackOrder(confirmation.orderId)}
              className="confirmation-primary"
            >
              Track order
            </button>
            <a
              href={confirmation.temporalUrl}
              target="_blank"
              rel="noreferrer"
              className="confirmation-secondary"
            >
              View in Temporal
            </a>
            <button
              onClick={() => setConfirmation(null)}
              className="confirmation-dismiss"
              aria-label="Dismiss order confirmation"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <section className="catalog-toolbar" aria-labelledby="shelves-title">
        <div>
          <p className="catalog-kicker">Browse the shelves</p>
          <h2 id="shelves-title">Enchanted editions</h2>
        </div>
        <div className="catalog-filter-group" aria-label="Filter books by collection">
          <div className="catalog-filters">
            {FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`catalog-filter${filter === value ? ' catalog-filter--active' : ''}`}
                aria-pressed={filter === value}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="catalog-count">
            {filtered.length} title{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </section>

      <div className="catalog-layout">
        <div className="catalog-main">
          {loading ? (
            <div className="book-grid" aria-label="Loading catalogue">
              {Array.from({ length: 6 }).map((_, index) => (
                <div className="book-card-skeleton" key={index} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="catalog-empty">No books are waiting on this shelf.</div>
          ) : (
            <div className="book-grid">
              {filtered.map(book => (
                <BookCard
                  key={book.id}
                  book={book}
                  cartItem={cart.find(i => i.book.id === book.id)}
                  onAddToCart={addToCart}
                />
              ))}
            </div>
          )}
        </div>

        <div className="cart-column">
          <div className="cart-sticky">
            <Cart
              items={cart}
              onRemove={removeFromCart}
              onCheckout={() => setShowCheckout(true)}
            />
          </div>
        </div>
      </div>

      <div className="catalog-disclaimer">
        Flourish &amp; Blotts accepts no responsibility for escaped books, Ministry raids,
        spontaneous prophecies, or owl-related delays.
      </div>

      {showCheckout && cart.length > 0 && (
        <CheckoutModal
          items={cart}
          onClose={() => setShowCheckout(false)}
          onSuccess={handleOrderSuccess}
        />
      )}
    </div>
  )
}
