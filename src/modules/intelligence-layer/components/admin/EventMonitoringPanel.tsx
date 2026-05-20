/**
 * Event Monitoring Panel
 * Real-time business event monitoring for the Intelligence Admin Dashboard
 */

import { useState, useEffect } from 'react';
import {
  Zap,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Eye,
  RotateCcw,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import { INTELLIGENCE_SOURCE_MODULES } from '@/modules/intelligence-layer/constants/shared';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Input } from '@/core/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';

// ============================================
// Types
// ============================================

interface BusinessEvent {
  id: string;
  eventType: string;
  eventName?: string;
  sourceModule: string;
  subsidiary: string;
  status: 'pending' | 'processed' | 'failed';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  triggeredBy?: string;
  triggeredByName?: string;
  entityId?: string;
  entityType?: string;
  currentState?: Record<string, any>;
  previousState?: Record<string, any>;
  tasksGenerated?: number;
  createdAt: Timestamp;
  processedAt?: Timestamp;
  errorMessage?: string;
}

type StatusFilter = 'all' | 'pending' | 'processed' | 'failed';
type TimeFilter = 'today' | 'week' | 'month' | 'all';

// ============================================
// Event Monitoring Panel Component
// ============================================

export function EventMonitoringPanel() {
  const [events, setEvents] = useState<BusinessEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<BusinessEvent | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Available modules for filtering (from shared constants)
  const modules = [
    { value: 'all', label: 'All Modules' },
    ...INTELLIGENCE_SOURCE_MODULES,
  ];

  // Fetch events based on filters
  useEffect(() => {
    setLoading(true);

    const eventsRef = collection(db, 'businessEvents');
    let constraints: any[] = [orderBy('createdAt', 'desc'), limit(100)];

    // Time filter
    if (timeFilter !== 'all') {
      const date = new Date();
      if (timeFilter === 'today') {
        date.setHours(0, 0, 0, 0);
      } else if (timeFilter === 'week') {
        date.setDate(date.getDate() - 7);
      } else if (timeFilter === 'month') {
        date.setMonth(date.getMonth() - 1);
      }
      constraints = [where('createdAt', '>=', Timestamp.fromDate(date)), ...constraints];
    }

    // Status filter
    if (statusFilter !== 'all') {
      constraints = [where('status', '==', statusFilter), ...constraints];
    }

    // Module filter
    if (moduleFilter !== 'all') {
      constraints = [where('sourceModule', '==', moduleFilter), ...constraints];
    }

    const q = query(eventsRef, ...constraints);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as BusinessEvent[];

      // Client-side search filter
      const filtered = searchQuery
        ? eventData.filter(e =>
            e.eventType.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.eventName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.triggeredByName?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : eventData;

      setEvents(filtered);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching events:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [statusFilter, timeFilter, moduleFilter, searchQuery]);

  // Retry failed event
  const handleRetryEvent = async (eventId: string) => {
    try {
      const eventRef = doc(db, 'businessEvents', eventId);
      await updateDoc(eventRef, {
        status: 'pending',
        errorMessage: null,
        retryAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error retrying event:', error);
    }
  };

  // View event details
  const handleViewDetails = (event: BusinessEvent) => {
    setSelectedEvent(event);
    setIsDetailOpen(true);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processed':
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Processed
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Format timestamp
  const formatTime = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get module label
  const getModuleLabel = (moduleId: string) => {
    const module = modules.find(m => m.value === moduleId);
    return module?.label || moduleId;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            {/* Time Filter */}
            <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            {/* Module Filter */}
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                {modules.map((module) => (
                  <SelectItem key={module.value} value={module.value}>
                    {module.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500" />
              Business Events
            </CardTitle>
            <Badge variant="outline">{events.length} events</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No events found matching your filters</p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  {/* Status Icon */}
                  <div className={`p-2 rounded-lg ${
                    event.status === 'processed' ? 'bg-green-100' :
                    event.status === 'pending' ? 'bg-amber-100' :
                    'bg-red-100'
                  }`}>
                    {event.status === 'processed' ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : event.status === 'pending' ? (
                      <Clock className="h-4 w-4 text-amber-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                  </div>

                  {/* Event Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {event.eventName || event.eventType}
                      </span>
                      {getStatusBadge(event.status)}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                      <span>{getModuleLabel(event.sourceModule)}</span>
                      <span>•</span>
                      <span>{formatTime(event.createdAt)}</span>
                      {event.triggeredByName && (
                        <>
                          <span>•</span>
                          <span>by {event.triggeredByName}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tasks Generated */}
                  {event.tasksGenerated !== undefined && event.tasksGenerated > 0 && (
                    <Badge variant="secondary">
                      {event.tasksGenerated} task{event.tasksGenerated !== 1 ? 's' : ''}
                    </Badge>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(event)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {event.status === 'failed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRetryEvent(event.id)}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" />
              Event Details
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Event Type</label>
                  <p className="font-medium">{selectedEvent.eventType}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Status</label>
                  <div className="mt-0.5">{getStatusBadge(selectedEvent.status)}</div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Source Module</label>
                  <p className="font-medium">{getModuleLabel(selectedEvent.sourceModule)}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Subsidiary</label>
                  <p className="font-medium capitalize">{selectedEvent.subsidiary}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Created At</label>
                  <p className="font-medium">{formatTime(selectedEvent.createdAt)}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Triggered By</label>
                  <p className="font-medium">{selectedEvent.triggeredByName || 'System'}</p>
                </div>
              </div>

              {/* Entity Info */}
              {selectedEvent.entityId && (
                <div>
                  <label className="text-sm text-muted-foreground">Entity</label>
                  <p className="font-medium">
                    {selectedEvent.entityType}: {selectedEvent.entityId}
                  </p>
                </div>
              )}

              {/* Error Message */}
              {selectedEvent.errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <label className="text-sm text-red-600 font-medium">Error Message</label>
                  <p className="text-sm text-red-700 mt-1">{selectedEvent.errorMessage}</p>
                </div>
              )}

              {/* Current State */}
              {selectedEvent.currentState && Object.keys(selectedEvent.currentState).length > 0 && (
                <div>
                  <label className="text-sm text-muted-foreground">Current State</label>
                  <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedEvent.currentState, null, 2)}
                  </pre>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                {selectedEvent.status === 'failed' && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleRetryEvent(selectedEvent.id);
                      setIsDetailOpen(false);
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry Event
                  </Button>
                )}
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EventMonitoringPanel;
