import React from 'react';
import { useSync } from '@/hooks/sync/useSync';

interface SyncStatusIndicatorProps {
  showDetails?: boolean;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ showDetails = false }) => {
  const {
    isSignalRConnected,
    isFallbackActive,
    lastSyncAt,
    triggerSync
  } = useSync();

  const getStatusIcon = () => {
    if (isSignalRConnected) return '⚡'; // Real-time aktiv
    if (isFallbackActive) return '🔄'; // Fallback aktiv
    return '📡'; // Ukjent status
  };

  const getStatusText = () => {
    if (isSignalRConnected) return 'Real-time';
    if (isFallbackActive) return 'Fallback sync';
    return 'Connecting...';
  };

  const getStatusColor = () => {
    if (isSignalRConnected) return 'text-green-600';
    if (isFallbackActive) return 'text-yellow-600';
    return 'text-gray-600';
  };

  if (!showDetails) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <span>{getStatusIcon()}</span>
        <span className={getStatusColor()}>{getStatusText()}</span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium text-gray-900">Sync Status</h3>
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{getStatusIcon()}</span>
          <span className={`font-medium ${getStatusColor()}`}>{getStatusText()}</span>
        </div>
      </div>
      
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>SignalR:</span>
          <span className={isSignalRConnected ? 'text-green-600' : 'text-red-600'}>
            {isSignalRConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Fallback sync:</span>
          <span className={isFallbackActive ? 'text-yellow-600' : 'text-gray-400'}>
            {isFallbackActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        
        {lastSyncAt && (
          <div className="flex justify-between">
            <span>Last sync:</span>
            <span>{lastSyncAt.toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      <div className="flex space-x-2 mt-4">
        <button
          onClick={triggerSync}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          Manual Sync
        </button>
      </div>
    </div>
  );
};
