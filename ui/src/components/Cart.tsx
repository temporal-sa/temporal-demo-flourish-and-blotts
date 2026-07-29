import type { CartItem } from '../types'
import { getBookCoverSrc } from '../bookCovers'

interface Props {
  items: CartItem[]
  onRemove: (bookId: string) => void
  onCheckout: () => void
}

export default function Cart({ items, onRemove, onCheckout }: Props) {
  const total = items.reduce((sum, i) => sum + i.book.price_galleons * i.quantity, 0)
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <aside className="cart-panel" aria-label="Shopping satchel">
      <div className="cart-panel-header">
        <div>
          <p className="cart-kicker">Your order</p>
          <h3 className="cart-title">Owl Post Satchel</h3>
        </div>
        <span className="cart-count" aria-label={`${itemCount} items`}>{itemCount}</span>
      </div>

      {items.length === 0 ? (
        <div className="cart-empty">
          <span className="cart-empty-mark" aria-hidden="true">✦</span>
          <p className="cart-empty-title">Your satchel is light</p>
          <p>Choose a volume from the shelves and we’ll wrap it for owl post.</p>
        </div>
      ) : (
        <>
          <div className="cart-items">
            {items.map(({ book, quantity }) => {
              const coverSrc = getBookCoverSrc(book.id)
              return (
                <div key={book.id} className="cart-item">
                  <div className="cart-item-cover" style={{ backgroundColor: book.cover_color }}>
                    {coverSrc && <img src={coverSrc} alt="" width="42" height="56" />}
                  </div>
                  <div className="cart-item-copy">
                    <p>{book.title}</p>
                    <span>{quantity} × {book.price_galleons} G</span>
                  </div>
                  <strong>{(book.price_galleons * quantity).toFixed(1)} G</strong>
                  <button
                    onClick={() => onRemove(book.id)}
                    className="cart-remove"
                    aria-label={`Remove ${book.title} from your satchel`}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>

          <div className="cart-total">
            <div className="cart-total-row">
              <span>Gringotts total</span>
              <strong>{total.toFixed(1)} G</strong>
            </div>
            <p>Taxes, charms, and owl treats included.</p>
            <button
              onClick={onCheckout}
              className="checkout-button"
            >
              Continue to checkout
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
