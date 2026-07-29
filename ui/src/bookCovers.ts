const BOOK_COVERS: Record<string, string> = {
  'mnbm-001': '/images/book-covers/mnbm-001.jpg',
  'hom-001': '/images/book-covers/hom-001.jpg',
  'mpp-001': '/images/book-covers/mpp-001.jpg',
  'bs-001': '/images/book-covers/bs-001.jpg',
  'voyages-001': '/images/book-covers/voyages-001.jpg',
  'tdda-001': '/images/book-covers/tdda-001.jpg',
  'bosl-001': '/images/book-covers/bosl-001.jpg',
  'fbwtft-001': '/images/book-covers/fbwtft-001.jpg',
  'drk-001': '/images/book-covers/drk-001.jpg',
  'qta-001': '/images/book-covers/qta-001.jpg',
}

export function getBookCoverSrc(bookId: string): string | undefined {
  return BOOK_COVERS[bookId]
}
