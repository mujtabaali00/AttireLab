'use client'

interface TablePaginationProps {
  currentPage: number
  totalPages: number
  totalCount: number
  onPageChange: (page: number) => void
}

// Single pagination footer used by every admin/customer table — keeps page
// controls looking identical everywhere instead of each table growing its
// own slightly-different version.
export function TablePagination({ currentPage, totalPages, totalCount, onPageChange }: TablePaginationProps) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 mt-auto flex-wrap gap-3">
      <span className="text-sm text-gray-500">{totalCount} Total Count</span>

      {totalPages > 1 && (
        <div className="flex items-center border border-gray-200 rounded divide-x divide-gray-200">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            title="Previous page"
            className="px-3 py-1.5 text-sm text-blue-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent"
          >
            Previous
          </button>

          {Array.from({ length: totalPages }).map((_, i) => {
            const page = i + 1
            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                title={`Page ${page}`}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  currentPage === page
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-blue-500 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            )
          })}

          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            title="Next page"
            className="px-3 py-1.5 text-sm text-blue-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
