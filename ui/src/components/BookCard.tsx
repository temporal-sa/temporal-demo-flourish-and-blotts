import type { Book, CartItem } from '../types'
import { getBookCoverSrc } from '../bookCovers'

interface Props {
  book: Book
  cartItem?: CartItem
  onAddToCart: (book: Book) => void
}

const CATEGORY_BADGES: Record<string, string> = {
  standard: 'Hogwarts Text',
  dangerous: 'Handle with Care',
  restricted: 'Restricted',
  rare: 'Rare Edition',
}

export default function BookCard({ book, cartItem, onAddToCart }: Props) {
  const badge = CATEGORY_BADGES[book.category] || CATEGORY_BADGES.standard
  const coverSrc = getBookCoverSrc(book.id)
  const outOfStock = book.in_stock === 0
  const lowStock = book.in_stock > 0 && book.in_stock <= 3

  return (
    <article className="book-card">
      <div className="book-cover-shell" style={{ backgroundColor: book.cover_color }}>
        {coverSrc && (
          <img
            src={coverSrc}
            alt=""
            className="book-cover-image"
            loading="lazy"
            width="600"
            height="800"
          />
        )}
        <div className="book-cover-vignette" />
        <span className={`category-badge category-badge--${book.category}`}>
          {badge}
        </span>
        <div className="book-cover-lettering">
          <h3 className="book-cover-title">{book.title}</h3>
          <p className="book-cover-author">by {book.author}</p>
        </div>
      </div>

      <div className="book-card-body">
        <p className="book-description">
          {book.description}
        </p>

        {book.requires_ministry_approval && (
          <p className="ministry-notice">
            Ministry approval required
          </p>
        )}

        <div className="book-purchase-row">
          <div className="book-price-block">
            <span className="book-price">{book.price_galleons} G</span>
            <span className={`stock-status${lowStock ? ' stock-status--low' : ''}`}>
              <span className="stock-dot" />
              {outOfStock ? 'Out of stock' : lowStock ? `Only ${book.in_stock} left` : `${book.in_stock} in stock`}
            </span>
          </div>

          <button
            onClick={() => onAddToCart(book)}
            disabled={outOfStock}
            className={`add-to-cart-button${cartItem ? ' add-to-cart-button--added' : ''}`}
            aria-label={cartItem ? `Add another copy of ${book.title} to your satchel` : `Add ${book.title} to your satchel`}
          >
            {cartItem ? `In satchel · ${cartItem.quantity}` : 'Add to satchel'}
          </button>
        </div>
      </div>
    </article>
  )
}
