'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useRealTimeSync } from '@/hooks/useRealTimeSync';

export interface ChartData {
  name: string;
  value: number;
  [key: string]: any;
}

export interface ChartConfig {
  type: 'line' | 'area' | 'bar' | 'pie';
  title: string;
  dataKey: string;
  xAxisKey?: string;
  yAxisKey?: string;
  colors?: string[];
  showLegend?: boolean;
  showTooltip?: boolean;
  showGrid?: boolean;
  height?: number;
  refreshInterval?: number;
}

interface RealTimeChartProps {
  config: ChartConfig;
  data: ChartData[];
  onDataUpdate?: (newData: ChartData[]) => void;
  className?: string;
  organizationId: string;
  eventTypes?: string[];
}

const DEFAULT_COLORS = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7c7c',
  '#8dd1e1',
  '#d084d0',
  '#ffb347',
  '#87ceeb',
];

export const RealTimeChart: React.FC<RealTimeChartProps> = ({
  config,
  data: initialData,
  onDataUpdate,
  className = '',
  organizationId,
  eventTypes = [],
}) => {
  const [data, setData] = useState<ChartData[]>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleRealTimeUpdate = useCallback((event: any) => {
    // Process real-time event and update chart data
    setData(prevData => {
      const newData = processEventData(event, prevData);
      setLastUpdate(new Date());
      
      if (onDataUpdate) {
        onDataUpdate(newData);
      }
      
      return newData;
    });
  }, [onDataUpdate]);

  const { isConnected, events } = useRealTimeSync({
    organizationId,
    onEvent: handleRealTimeUpdate
  });

  useEffect(() => {
    // Set up refresh interval if specified
    if (config.refreshInterval && config.refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        refreshData();
      }, config.refreshInterval);
    }

    return () => {
      // Clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [config.refreshInterval]);

  const processEventData = (event: any, currentData: ChartData[]): ChartData[] => {
    // This is a generic processor - you might want to customize this
    // based on your specific event types and data structure
    
    switch (event.type) {
      case 'order_created':
        return updateOrderData(event.data, currentData);
      case 'product_viewed':
        return updateProductViewData(event.data, currentData);
      case 'payment_completed':
        return updatePaymentData(event.data, currentData);
      case 'inventory_updated':
        return updateInventoryData(event.data, currentData);
      default:
        return currentData;
    }
  };

  const updateOrderData = (orderData: any, currentData: ChartData[]): ChartData[] => {
    const now = new Date();
    const timeKey = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Update or add data point for current time
    const existingIndex = currentData.findIndex(item => item.name === timeKey);
    
    if (existingIndex >= 0) {
      const updatedData = [...currentData];
      updatedData[existingIndex].value += orderData.total || 1;
      return updatedData;
    } else {
      // Keep only last 20 data points for performance
      const newData = [...currentData.slice(-19), {
        name: timeKey,
        value: orderData.total || 1,
        timestamp: now.getTime(),
      }];
      return newData;
    }
  };

  const updateProductViewData = (productData: any, currentData: ChartData[]): ChartData[] => {
    const productName = productData.name || 'Unknown Product';
    const existingIndex = currentData.findIndex(item => item.name === productName);
    
    if (existingIndex >= 0) {
      const updatedData = [...currentData];
      updatedData[existingIndex].value += 1;
      return updatedData;
    } else {
      return [...currentData, {
        name: productName,
        value: 1,
        category: productData.category,
      }];
    }
  };

  const updatePaymentData = (paymentData: any, currentData: ChartData[]): ChartData[] => {
    const method = paymentData.method || 'Unknown';
    const existingIndex = currentData.findIndex(item => item.name === method);
    
    if (existingIndex >= 0) {
      const updatedData = [...currentData];
      updatedData[existingIndex].value += paymentData.amount || 1;
      return updatedData;
    } else {
      return [...currentData, {
        name: method,
        value: paymentData.amount || 1,
      }];
    }
  };

  const updateInventoryData = (inventoryData: any, currentData: ChartData[]): ChartData[] => {
    const productName = inventoryData.productName || 'Unknown Product';
    const existingIndex = currentData.findIndex(item => item.name === productName);
    
    if (existingIndex >= 0) {
      const updatedData = [...currentData];
      updatedData[existingIndex].value = inventoryData.stock || 0;
      return updatedData;
    } else {
      return [...currentData, {
        name: productName,
        value: inventoryData.stock || 0,
        category: inventoryData.category,
      }];
    }
  };

  const refreshData = async () => {
    setIsLoading(true);
    try {
      // Implement data refresh logic here
      // This would typically fetch fresh data from your API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated delay
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error refreshing chart data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTooltipValue = (value: any, name: string) => {
    if (typeof value === 'number') {
      // Format based on the chart type and data
      if (name.toLowerCase().includes('amount') || name.toLowerCase().includes('revenue')) {
        return `$${value.toLocaleString()}`;
      } else if (name.toLowerCase().includes('percentage') || name.toLowerCase().includes('rate')) {
        return `${value.toFixed(1)}%`;
      } else {
        return value.toLocaleString();
      }
    }
    return value;
  };

  const renderChart = () => {
    const colors = config.colors || DEFAULT_COLORS;
    const height = config.height || 300;

    const commonProps = {
      data,
      height,
    };

    switch (config.type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            {config.showGrid !== false && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis 
              dataKey={config.xAxisKey || 'name'} 
              tick={{ fontSize: 12 }}
            />
            <YAxis tick={{ fontSize: 12 }} />
            {config.showTooltip !== false && (
              <Tooltip 
                formatter={formatTooltipValue}
                labelStyle={{ color: '#374151' }}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
            )}
            {config.showLegend && <Legend />}
            <Line 
              type="monotone" 
              dataKey={config.dataKey} 
              stroke={colors[0]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {config.showGrid !== false && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis 
              dataKey={config.xAxisKey || 'name'} 
              tick={{ fontSize: 12 }}
            />
            <YAxis tick={{ fontSize: 12 }} />
            {config.showTooltip !== false && (
              <Tooltip 
                formatter={formatTooltipValue}
                labelStyle={{ color: '#374151' }}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
            )}
            {config.showLegend && <Legend />}
            <Area 
              type="monotone" 
              dataKey={config.dataKey} 
              stroke={colors[0]}
              fill={colors[0]}
              fillOpacity={0.6}
            />
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            {config.showGrid !== false && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis 
              dataKey={config.xAxisKey || 'name'} 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 12 }} />
            {config.showTooltip !== false && (
              <Tooltip 
                formatter={formatTooltipValue}
                labelStyle={{ color: '#374151' }}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
            )}
            {config.showLegend && <Legend />}
            <Bar 
              dataKey={config.dataKey} 
              fill={colors[0]}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        );

      case 'pie':
        return (
          <PieChart {...commonProps}>
            {config.showTooltip !== false && (
              <Tooltip 
                formatter={formatTooltipValue}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
            )}
            {config.showLegend && <Legend />}
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey={config.dataKey}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={colors[index % colors.length]} 
                />
              ))}
            </Pie>
          </PieChart>
        );

      default:
        return <div>Unsupported chart type</div>;
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">{config.title}</h3>
          <div className="flex items-center space-x-2">
            {/* Connection Status */}
            <div className="flex items-center">
              <div 
                className={`w-2 h-2 rounded-full mr-2 ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-xs text-gray-500">
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>

            {/* Last Update */}
            <div className="text-xs text-gray-500">
              Updated: {lastUpdate.toLocaleTimeString()}
            </div>

            {/* Loading Indicator */}
            {isLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
          </div>
        </div>
      </div>

      {/* Chart Content */}
      <div className="p-6">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={config.height || 300}>
            {renderChart()}
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-gray-400 text-lg mb-2">No data available</div>
              <div className="text-gray-500 text-sm">
                Data will appear here as events occur
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealTimeChart;
