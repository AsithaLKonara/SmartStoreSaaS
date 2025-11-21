'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { Search, Filter, X, ChevronDown } from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'product' | 'customer' | 'order' | 'category';
  title: string;
  description?: string;
  relevance: number;
  metadata: any;
  highlights: string[];
}

interface SearchFilters {
  category?: string;
  brand?: string;
  priceRange?: { min: number; max: number };
  minPrice?: number;
  maxPrice?: number;
  startDate?: Date;
  endDate?: Date;
  status?: string;
  dateRange?: { start: Date; end: Date };
  tags?: string[];
  location?: string;
}

interface AdvancedSearchProps {
  placeholder?: string;
  onResultSelect?: (result: SearchResult) => void;
  defaultType?: 'global' | 'products' | 'customers' | 'orders';
  showFilters?: boolean;
  className?: string;
}

export function AdvancedSearch({
  placeholder = 'Search products, customers, orders...',
  onResultSelect,
  defaultType = 'global',
  showFilters = true,
  className = ''
}: AdvancedSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchType, setSearchType] = useState(defaultType);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);

  const debouncedQuery = useDebounce(query, 300);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch search suggestions
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(`/api/search?action=suggestions&query=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  }, []);

  // Perform search
  const performSearch = useCallback(async (searchQuery: string, type: string, searchFilters: SearchFilters) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setAnalytics(null);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        action: type,
        query: searchQuery,
        sortBy: 'relevance',
        limit: '20'
      });

      // Add filters to params
      if (searchFilters.category) params.append('category', searchFilters.category);
      if (searchFilters.brand) params.append('brand', searchFilters.brand);
      if (searchFilters.status) params.append('status', searchFilters.status);
      if (searchFilters.priceRange?.min) params.append('minPrice', searchFilters.priceRange.min.toString());
      if (searchFilters.priceRange?.max) params.append('maxPrice', searchFilters.priceRange.max.toString());
      if (searchFilters.dateRange?.start) params.append('startDate', searchFilters.dateRange.start.toISOString());
      if (searchFilters.dateRange?.end) params.append('endDate', searchFilters.dateRange.end.toISOString());

      const response = await fetch(`/api/search?${params.toString()}`);
      const data = await response.json();
      
      setResults(data.results || []);
      setAnalytics(data.analytics || null);
    } catch (error) {
      console.error('Error performing search:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle debounced search
  useEffect(() => {
    if (debouncedQuery) {
      fetchSuggestions(debouncedQuery);
      performSearch(debouncedQuery, searchType, filters);
    } else {
      setResults([]);
      setSuggestions([]);
      setAnalytics(null);
    }
  }, [debouncedQuery, searchType, filters, fetchSuggestions, performSearch]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = suggestions.length + results.length;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          if (selectedIndex < suggestions.length) {
            setQuery(suggestions[selectedIndex]);
          } else {
            const resultIndex = selectedIndex - suggestions.length;
            if (results[resultIndex]) {
              handleResultSelect(results[resultIndex]);
            }
          }
        } else if (query.trim()) {
          performSearch(query, searchType, filters);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle result selection
  const handleResultSelect = (result: SearchResult) => {
    onResultSelect?.(result);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: string) => {
    setQuery(suggestion);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({});
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={searchRef}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="block w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        {/* Search Type Selector */}
        <div className="absolute inset-y-0 right-0 flex items-center">
          <select
            value={searchType}
<<<<<<< HEAD
            onChange={(e) => setSearchType(e.target.value as 'global' | 'products' | 'customers' | 'orders')}
=======
                            onChange={(e) => setSearchType(e.target.value as 'global' | 'products' | 'customers' | 'orders')}
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7
            className="h-full px-3 py-2 text-sm border-l border-gray-300 dark:border-gray-600 bg-transparent text-gray-700 dark:text-gray-300 focus:outline-none"
          >
            <option value="global">All</option>
            <option value="products">Products</option>
            <option value="customers">Customers</option>
            <option value="orders">Orders</option>
          </select>
        </div>

        {/* Filter Button */}
        {showFilters && (
          <button
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            className="absolute inset-y-0 right-16 flex items-center px-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <Filter className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && showFiltersPanel && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <input
                type="text"
                value={filters.category || ''}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                placeholder="Filter by category"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Brand Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Brand
              </label>
              <input
                type="text"
                value={filters.brand || ''}
                onChange={(e) => handleFilterChange('brand', e.target.value)}
                placeholder="Filter by brand"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Price Range
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  value={filters.priceRange?.min || ''}
                  onChange={(e) => handleFilterChange('priceRange', {
                    ...filters.priceRange,
                    min: e.target.value ? parseFloat(e.target.value) : undefined
                  })}
                  placeholder="Min"
                  className="w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  value={filters.priceRange?.max || ''}
                  onChange={(e) => handleFilterChange('priceRange', {
                    ...filters.priceRange,
                    max: e.target.value ? parseFloat(e.target.value) : undefined
                  })}
                  placeholder="Max"
                  className="w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Clear Filters */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Search Results Dropdown */}
      {isOpen && (query.trim() || suggestions.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {/* Loading State */}
          {isLoading && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2">Searching...</p>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && !isLoading && (
            <div className="border-b border-gray-200 dark:border-gray-700">
              <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Suggestions
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    selectedIndex === index ? 'bg-blue-50 dark:bg-blue-900' : ''
                  }`}
                >
                  <div className="flex items-center">
                    <Search className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-900 dark:text-white">{suggestion}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Search Results */}
          {results.length > 0 && !isLoading && (
            <div>
              <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Results ({results.length})
              </div>
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleResultSelect(result)}
                  className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    selectedIndex === suggestions.length + index ? 'bg-blue-50 dark:bg-blue-900' : ''
                  }`}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center mr-3">
                      {result.type === 'product' && '📦'}
                      {result.type === 'customer' && '👤'}
                      {result.type === 'order' && '📋'}
                      {result.type === 'category' && '📁'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {result.title}
                      </div>
                      {result.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {result.description}
                        </div>
                      )}
                      {result.highlights.length > 0 && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {result.highlights.slice(0, 2).join(' • ')}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
                      {Math.round(result.relevance)}%
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {!isLoading && query.trim() && results.length === 0 && suggestions.length === 0 && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No results found for "{query}"
            </div>
          )}

          {/* Analytics Summary */}
          {analytics && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Search completed in {analytics.searchTime}ms
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 