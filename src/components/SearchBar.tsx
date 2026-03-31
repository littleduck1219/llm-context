'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

interface SearchResult {
  id: string;
  sessionId: string;
  sessionTitle: string;
  role: string;
  content: string;
  timestamp: string;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery);

    if (searchQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setIsOpen(true);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-80">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="메시지 검색..."
          className="w-full pl-10 pr-8 py-2 bg-slate-100 dark:bg-slate-700 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2"
          >
            <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
          </button>
        )}
      </div>

      {/* 검색 결과 드롭다운 */}
      {isOpen && (
        <div className="absolute top-full mt-2 w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 max-h-96 overflow-auto z-50">
          {isLoading ? (
            <div className="p-4 text-center text-slate-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto mb-2"></div>
              검색 중...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-slate-500">
              검색 결과가 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {results.map((result) => (
                <button
                  key={result.id}
                  className="w-full p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  onClick={() => {
                    onSearch(result.sessionId);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        result.role === 'user'
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {result.role === 'user' ? '사용자' : '어시스턴트'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {result.sessionTitle}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                    {result.content}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(result.timestamp).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
