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

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const query = searchParams.get('query') || '';
    const sortBy = searchParams.get('sortBy') || 'relevance';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const category = searchParams.get('category');
    const brand = searchParams.get('brand');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { organization: true }
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const filters: {
      category?: string;
      brand?: string;
      priceRange?: { min: number; max: number };
      status?: string;
      dateRange?: { start: Date; end: Date };
    } = {};
    if (category) filters.category = category;
    if (brand) filters.brand = brand;
    if (minPrice || maxPrice) {
      filters.priceRange = {
        min: minPrice ? parseFloat(minPrice) : 0,
        max: maxPrice ? parseFloat(maxPrice) : 999999
      };
    }
    if (status) filters.status = status;
    if (startDate || endDate) {
      filters.dateRange = {
        start: startDate ? new Date(startDate) : new Date(0),
        end: endDate ? new Date(endDate) : new Date()
      };
    }

    const searchOptions = {
      query,
      filters,
      sortBy: sortBy as 'relevance' | 'price' | 'name' | 'date',
      sortOrder: sortOrder as 'asc' | 'desc',
      limit,
      offset
    };

    switch (action) {
      case 'products':
        const productResults = await searchService.searchProducts(user.organizationId, searchOptions);
        return NextResponse.json(productResults);

      case 'customers':
        const customerResults = await searchService.searchCustomers(user.organizationId, searchOptions);
        return NextResponse.json(customerResults);

      case 'orders':
        const orderResults = await searchService.searchOrders(user.organizationId, searchOptions);
        return NextResponse.json(orderResults);

      case 'global':
        const globalResults = await searchService.globalSearch(user.organizationId, searchOptions);
        return NextResponse.json(globalResults);

      case 'suggestions':
        const suggestions = await searchService.getSearchSuggestions(user.organizationId, query);
        return NextResponse.json({ suggestions });

      case 'popular':
        const popularSearches = await searchService.getPopularSearches(user.organizationId);
        return NextResponse.json({ searches: popularSearches });

      default:
        // Default to global search
        const defaultResults = await searchService.globalSearch(user.organizationId, searchOptions);
        return NextResponse.json(defaultResults);
    }
  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { organization: true }
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    switch (action) {
      case 'search':
        const searchOptions = {
          query: data.query || '',
          filters: data.filters || {},
          sortBy: data.sortBy || 'relevance',
          sortOrder: data.sortOrder || 'desc',
          limit: data.limit || 20,
          offset: data.offset || 0
        };

        let results;
        switch (data.type) {
          case 'products':
            results = await searchService.searchProducts(user.organizationId, searchOptions);
            break;
          case 'customers':
            results = await searchService.searchCustomers(user.organizationId, searchOptions);
            break;
          case 'orders':
            results = await searchService.searchOrders(user.organizationId, searchOptions);
            break;
          default:
            results = await searchService.globalSearch(user.organizationId, searchOptions);
        }

        return NextResponse.json(results);

      case 'suggestions':
        const suggestions = await searchService.getSearchSuggestions(user.organizationId, data.query);
        return NextResponse.json({ suggestions });

      case 'save-search':
        // Save search query to user's search history
        await prisma.searchHistory.create({
          data: {
            userId: user.id,
            query: data.query,
            searchType: data.type || 'global',
            filters: data.filters || {},
            resultsCount: data.resultCount || 0
          }
        });
        return NextResponse.json({ success: true });

      case 'get-search-history':
        const searchHistory = await prisma.searchHistory.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 10
        });
        return NextResponse.json({ history: searchHistory });

      case 'clear-search-history':
        await prisma.searchHistory.deleteMany({
          where: { userId: user.id }
        });
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 