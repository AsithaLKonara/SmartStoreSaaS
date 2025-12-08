'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BIQuery {
  dimensions: string[];
  measures: string[];
  filters?: Array<Record<string, unknown>>;
  groupBy?: string[];
}

interface BIWidget {
  id: string;
  type: 'chart' | 'table' | 'metric';
  title: string;
  query: BIQuery;
}

export function BIDashboard() {
  const [widgets, setWidgets] = useState<BIWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      
      // Load default widgets
      const defaultWidgets: BIWidget[] = [
        {
          id: 'revenue',
          type: 'metric',
          title: 'Total Revenue',
          query: {
            dimensions: ['order'],
            measures: ['revenue'],
          },
        },
        {
          id: 'orders',
          type: 'metric',
          title: 'Total Orders',
          query: {
            dimensions: ['order'],
            measures: ['count'],
          },
        },
        {
          id: 'sales-forecast',
          type: 'chart',
          title: 'Sales Forecast',
          query: {
            dimensions: ['date'],
            measures: ['revenue'],
          },
        },
      ];

      setWidgets(defaultWidgets);

      // Fetch data for each widget with retry logic
      const { fetchJSON } = await import('@/lib/api-client');
      const dataPromises = defaultWidgets.map(async widget => {
        const result = await fetchJSON('/api/analytics/bi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: widget.query }),
        });
        return { widgetId: widget.id, data: result };
      });

      const results = await Promise.all(dataPromises);
      const dataMap: Record<string, unknown> = {};
      results.forEach(({ widgetId, data }) => {
        dataMap[widgetId] = data;
      });

      setData(dataMap);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Business Intelligence Dashboard</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {widgets.map(widget => (
          <Card key={widget.id}>
            <CardHeader>
              <CardTitle>{widget.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {widget.type === 'metric' && (
                <div className="text-3xl font-bold">
                  {widget.id === 'revenue' && `$${data[widget.id]?.data?.[0]?.revenue?.toFixed(2) || '0'}`}
                  {widget.id === 'orders' && data[widget.id]?.total || '0'}
                </div>
              )}
              {widget.type === 'chart' && (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  Chart visualization would go here
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

