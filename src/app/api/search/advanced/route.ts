import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdvancedSearchService } from '@/lib/search/advancedSearchService';

const searchService = new AdvancedSearchService();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { organization: true }
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const query = searchParams.get('query');
    const type = searchParams.get('type');

    switch (action) {
      case 'suggestions':
        if (!query) {
          return NextResponse.json({ error: 'Query required' }, { status: 400 });
        }
        const suggestions = await searchService.getSearchSuggestions(user.organizationId, query);
        return NextResponse.json({ suggestions });

      case 'popular':
        const popularSearches = await searchService.getPopularSearches(user.organizationId);
        return NextResponse.json({ searches: popularSearches });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Advanced Search API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { organization: true }
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await _request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'search-products':
        if (!data.query) {
          return NextResponse.json({ error: 'Query required' }, { status: 400 });
        }
        const productResults = await searchService.searchProducts(user.organizationId, {
          query: data.query,
          filters: data.filters,
          sortBy: data.sortBy,
          sortOrder: data.sortOrder,
          limit: data.limit,
          offset: data.offset,
          includeInactive: data.includeInactive
        });
        return NextResponse.json(productResults);

      case 'search-customers':
        if (!data.query) {
          return NextResponse.json({ error: 'Query required' }, { status: 400 });
        }
        const customerResults = await searchService.searchCustomers(user.organizationId, {
          query: data.query,
          filters: data.filters,
          sortBy: data.sortBy,
          sortOrder: data.sortOrder,
          limit: data.limit,
          offset: data.offset,
          includeInactive: data.includeInactive
        });
        return NextResponse.json(customerResults);

      case 'search-orders':
        if (!data.query) {
          return NextResponse.json({ error: 'Query required' }, { status: 400 });
        }
        const orderResults = await searchService.searchOrders(user.organizationId, {
          query: data.query,
          filters: data.filters,
          sortBy: data.sortBy,
          sortOrder: data.sortOrder,
          limit: data.limit,
          offset: data.offset,
          includeInactive: data.includeInactive
        });
        return NextResponse.json(orderResults);

      case 'global-search':
        if (!data.query) {
          return NextResponse.json({ error: 'Query required' }, { status: 400 });
        }
        const globalResults = await searchService.globalSearch(user.organizationId, {
          query: data.query,
          filters: data.filters,
          sortBy: data.sortBy,
          sortOrder: data.sortOrder,
          limit: data.limit,
          offset: data.offset,
          includeInactive: data.includeInactive
        });
        return NextResponse.json(globalResults);

      case 'search-with-filters':
        if (!data.query) {
          return NextResponse.json({ error: 'Query required' }, { status: 400 });
        }

        const searchType = data.type || 'global';
        let results;

        switch (searchType) {
          case 'products':
            results = await searchService.searchProducts(user.organizationId, {
              query: data.query,
              filters: data.filters,
              sortBy: data.sortBy,
              sortOrder: data.sortOrder,
              limit: data.limit,
              offset: data.offset,
              includeInactive: data.includeInactive
            });
            break;
          case 'customers':
            results = await searchService.searchCustomers(user.organizationId, {
              query: data.query,
              filters: data.filters,
              sortBy: data.sortBy,
              sortOrder: data.sortOrder,
              limit: data.limit,
              offset: data.offset,
              includeInactive: data.includeInactive
            });
            break;
          case 'orders':
            results = await searchService.searchOrders(user.organizationId, {
              query: data.query,
              filters: data.filters,
              sortBy: data.sortBy,
              sortOrder: data.sortOrder,
              limit: data.limit,
              offset: data.offset,
              includeInactive: data.includeInactive
            });
            break;
          default:
            results = await searchService.globalSearch(user.organizationId, {
              query: data.query,
              filters: data.filters,
              sortBy: data.sortBy,
              sortOrder: data.sortOrder,
              limit: data.limit,
              offset: data.offset,
              includeInactive: data.includeInactive
            });
        }

        return NextResponse.json(results);

      case 'advanced-search':
        if (!data.query) {
          return NextResponse.json({ error: 'Query required' }, { status: 400 });
        }

        // Advanced search with multiple criteria
        const advancedOptions = {
          query: data.query,
          filters: {
            category: data.category,
            brand: data.brand,
            priceRange: data.priceRange,
            status: data.status,
            dateRange: data.dateRange ? {
              start: new Date(data.dateRange.start),
              end: new Date(data.dateRange.end)
            } : undefined,
            tags: data.tags,
            location: data.location
          },
          sortBy: data.sortBy || 'relevance',
          sortOrder: data.sortOrder || 'desc',
          limit: data.limit || 20,
          offset: data.offset || 0,
          includeInactive: data.includeInactive || false
        };

        const advancedSearchType = data.searchType || 'global';
        let advancedResults;

        switch (advancedSearchType) {
          case 'products':
            advancedResults = await searchService.searchProducts(user.organizationId, advancedOptions);
            break;
          case 'customers':
            advancedResults = await searchService.searchCustomers(user.organizationId, advancedOptions);
            break;
          case 'orders':
            advancedResults = await searchService.searchOrders(user.organizationId, advancedOptions);
            break;
          default:
            advancedResults = await searchService.globalSearch(user.organizationId, advancedOptions);
        }

        return NextResponse.json(advancedResults);

      case 'search-analytics':
        // Get search analytics for the organization
        const analytics = {
          totalSearches: 0,
          popularQueries: [],
          searchTrends: [],
          topResults: []
        };

        // In a real implementation, you would track search analytics
        // For now, return basic analytics
        return NextResponse.json({ analytics });

      case 'save-search':
        // Save search query for future reference
        const savedSearch = await prisma.searchHistory.create({
          data: {
            userId: user.id,
            query: data.query,
            filters: data.filters,
            resultsCount: data.resultsCount,
            searchType: data.searchType
          }
        });
        return NextResponse.json({ savedSearch });

      case 'get-saved-searches':
        const savedSearches = await prisma.searchHistory.findMany({
          where: { 
            userId: user.id
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        });
        return NextResponse.json({ savedSearches });

      case 'delete-saved-search':
        await prisma.searchHistory.delete({
          where: { id: data.searchId }
        });
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Advanced Search API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 