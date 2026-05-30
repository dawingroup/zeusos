// ============================================================================
// COMPETITOR LIST PAGE
// ZeusOS v2.0 - Market Intelligence Module
// List and manage tracked competitors (Firestore-backed)
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  LayoutGrid, 
  List, 
  Bell, 
  BellOff, 
  Building2, 
  ExternalLink,
  ArrowLeftRight,
  Radar,
} from 'lucide-react';

import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Badge } from '@/core/components/ui/badge';
import { Skeleton } from '@/core/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core/components/ui/tooltip';

import { useCompetitors } from '../hooks/useCompetitors';
import { AddCompetitorDialog } from '../components/competitor/AddCompetitorDialog';
import { DiscoverCompetitorsDialog } from '../components/competitor/DiscoverCompetitorsDialog';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  THREAT_LEVEL_LABELS,
  THREAT_LEVEL_COLORS,
  INDUSTRY_LABELS,
  COMPETITOR_TYPE_LABELS,
  ThreatLevel,
} from '../constants/competitor.constants';
import { MODULE_COLOR } from '../constants';

const CompetitorListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [threatFilter, setThreatFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<string>('grid');
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDiscoverDialog, setShowDiscoverDialog] = useState(false);

  const { competitors, loading, toggleAlerts, addCompetitor } = useCompetitors({
    search: searchQuery,
    sector: sectorFilter !== 'all' ? sectorFilter : undefined,
    threatLevel: threatFilter !== 'all' ? threatFilter as ThreatLevel : undefined,
  });

  const handleCompetitorClick = (competitorId: string) => {
    navigate(`/market-intel/competitors/${competitorId}`);
  };

  const handleCompare = () => {
    if (selectedForComparison.length >= 2) {
      navigate(`/market-intel/competitors/compare?ids=${selectedForComparison.join(',')}`);
    }
  };

  const toggleSelection = (competitorId: string) => {
    setSelectedForComparison(prev =>
      prev.includes(competitorId)
        ? prev.filter(id => id !== competitorId)
        : prev.length < 4
          ? [...prev, competitorId]
          : prev
    );
  };

  const ThreatLevelBadge: React.FC<{ level: ThreatLevel }> = ({ level }) => {
    const color = THREAT_LEVEL_COLORS[level] || '#6B7280';
    const label = THREAT_LEVEL_LABELS[level] || level;
    return (
      <Badge
        style={{
          backgroundColor: `${color}20`,
          color: color,
        }}
      >
        {label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>System · Market Intel</div>
          <h1 className="display">Competitors</h1>
          <p className="text-muted-foreground mt-1">Track and analyze your competitive landscape</p>
        </div>
        <div className="flex gap-2">
          {selectedForComparison.length >= 2 && (
            <Button
              variant="outline"
              onClick={handleCompare}
              style={{ color: MODULE_COLOR, borderColor: MODULE_COLOR }}
            >
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              Compare ({selectedForComparison.length})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowDiscoverDialog(true)}
            style={{ color: MODULE_COLOR, borderColor: MODULE_COLOR }}
          >
            <Radar className="h-4 w-4 mr-2" />
            Discover
          </Button>
          <Button style={{ backgroundColor: MODULE_COLOR }} onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Competitor
          </Button>
        </div>
      </div>

      {/* Add Competitor Dialog */}
      <AddCompetitorDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSubmit={addCompetitor}
        userId={user?.uid || 'unknown'}
      />

      {/* Discover Competitors Dialog */}
      <DiscoverCompetitorsDialog
        open={showDiscoverDialog}
        onOpenChange={setShowDiscoverDialog}
        existingCompetitorNames={competitors.map(c => c.name)}
        onAddCompetitors={async (inputs) => {
          for (const input of inputs) {
            await addCompetitor(input, user?.uid || 'unknown');
          }
        }}
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search competitors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Industries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {Object.entries(INDUSTRY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={threatFilter} onValueChange={setThreatFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Threat Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {Object.entries(THREAT_LEVEL_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: THREAT_LEVEL_COLORS[key as ThreatLevel] }}
                      />
                      {label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1" />

            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                className="rounded-r-none"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
                className="rounded-l-none"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {competitors.length} competitor{competitors.length !== 1 ? 's' : ''} found
        </p>
        {selectedForComparison.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedForComparison([])}>
            Clear Selection
          </Button>
        )}
      </div>

      {/* Competitors Grid/List */}
      <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
        {competitors.map((competitor) => (
          <Card
            key={competitor.id}
            className={`cursor-pointer hover:shadow-lg transition-all ${
              selectedForComparison.includes(competitor.id) ? 'ring-2' : ''
            }`}
            style={{
              borderColor: selectedForComparison.includes(competitor.id) ? MODULE_COLOR : undefined,
            }}
            onClick={() => handleCompetitorClick(competitor.id)}
          >
            <CardContent className="p-4">
              <div className={`flex ${viewMode === 'grid' ? 'flex-col' : 'flex-row items-center'} gap-4`}>
                <div className="flex items-start gap-3">
                  <div
                    className="h-14 w-14 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${MODULE_COLOR}20`, color: MODULE_COLOR }}
                  >
                    {competitor.logoUrl ? (
                      <img src={competitor.logoUrl} alt={competitor.name} className="h-full w-full rounded-lg object-cover" />
                    ) : (
                      <Building2 className="h-7 w-7" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{competitor.name}</h3>
                      {competitor.website && (
                        <a
                          href={competitor.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {competitor.industries?.map(i => INDUSTRY_LABELS[i] || i).join(', ') || 'No industry'}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <ThreatLevelBadge level={competitor.threatLevel} />
                      <Badge variant="outline" className="capitalize">
                        {COMPETITOR_TYPE_LABELS[competitor.type] || competitor.type}
                      </Badge>
                    </div>
                  </div>
                </div>

                {viewMode === 'grid' && competitor.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {competitor.description}
                  </p>
                )}

                {/* Metrics */}
                <div className={`flex gap-4 ${viewMode === 'grid' ? 'mt-2' : ''}`}>
                  {competitor.estimatedMarketShare !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground">Market Share</p>
                      <p className="font-medium">{competitor.estimatedMarketShare.toFixed(1)}%</p>
                    </div>
                  )}
                  {competitor.employeeCount && (
                    <div>
                      <p className="text-xs text-muted-foreground">Employees</p>
                      <p className="font-medium">{competitor.employeeCount.toLocaleString()}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{competitor.status}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className={`flex items-center gap-2 ${viewMode === 'grid' ? 'mt-auto pt-3 border-t' : 'ml-auto'}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelection(competitor.id);
                    }}
                    style={{
                      color: selectedForComparison.includes(competitor.id) ? MODULE_COLOR : undefined,
                    }}
                  >
                    {selectedForComparison.includes(competitor.id) ? 'Selected' : 'Compare'}
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAlerts(competitor.id);
                          }}
                          style={{
                            color: competitor.monitoringFrequency === 'weekly' ? MODULE_COLOR : undefined,
                          }}
                        >
                          {competitor.monitoringFrequency === 'weekly' ? (
                            <Bell className="h-4 w-4" />
                          ) : (
                            <BellOff className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {competitor.monitoringFrequency === 'weekly' ? 'Monitoring: Weekly' : `Monitoring: ${competitor.monitoringFrequency}`}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {competitors.length === 0 && !loading && (
        <Card className="p-12 text-center">
          <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Competitors Found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || sectorFilter !== 'all' || threatFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Start tracking your first competitor'}
          </p>
          <Button style={{ backgroundColor: MODULE_COLOR }} onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Competitor
          </Button>
        </Card>
      )}
    </div>
  );
};

export default CompetitorListPage;
