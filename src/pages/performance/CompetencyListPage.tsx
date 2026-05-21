/**
 * CompetencyListPage.tsx
 * Competency framework management with category organization
 * ZeusOS v2.0 - Phase 8.9
 * Updated to use Firebase via useDevelopment hook
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Download,
  Brain,
  ChevronDown,
  ChevronRight,
  CheckCircle,
} from 'lucide-react';

import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Badge } from '@/core/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { Skeleton } from '@/core/components/ui/skeleton';
import { useDevelopment } from '@/modules/hr-central/performance/hooks/useDevelopment';
import { useGlobalState } from '@/integration/store';
import { useAuth } from '@/core/hooks/useAuth';
import type { CompetencyCategory } from '@/modules/hr-central/performance/types/development.types';
import { fixCompetenciesWithEmptyCompanyId, getOrganizationIdFromEmail } from '@/modules/hr-central/performance/utils/fixCompetencyData';

const PERFORMANCE_COLOR = '#FF5722';

// Proficiency levels
const PROFICIENCY_LEVELS = [
  { level: 'novice', label: 'Novice', color: '#e0e0e0', numeric: 1 },
  { level: 'beginner', label: 'Beginner', color: '#90caf9', numeric: 2 },
  { level: 'intermediate', label: 'Intermediate', color: '#66bb6a', numeric: 3 },
  { level: 'advanced', label: 'Advanced', color: '#ffa726', numeric: 4 },
  { level: 'expert', label: 'Expert', color: '#ab47bc', numeric: 5 },
];

// Competency categories
const COMPETENCY_CATEGORIES: Array<{ value: CompetencyCategory; label: string }> = [
  { value: 'technical', label: 'Technical Skills' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'client', label: 'Client Management' },
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'core', label: 'Core Competencies' },
];

export function CompetencyListPage() {
  const navigate = useNavigate();
  const { state } = useGlobalState();
  const { user } = useAuth();

  // Get organization ID from user email as fallback
  const organizationId = state.currentOrganizationId ||
    (user?.email ? getOrganizationIdFromEmail(user.email) : '');

  console.log('[CompetencyListPage] Using organizationId:', organizationId);

  const {
    competencies,
    isLoading,
    error,
    seedCompetencies,
    loadCompetencies,
  } = useDevelopment({
    companyId: organizationId,
    autoLoad: true,
  });

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CompetencyCategory | 'all'>('all');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    COMPETENCY_CATEGORIES.map(c => c.value)
  );
  const [isSeedingCompetencies, setIsSeedingCompetencies] = useState(false);
  const [isFixingData, setIsFixingData] = useState(false);

  // Filter competencies
  const filteredCompetencies = useMemo(() => {
    return competencies.filter(comp => {
      if (search && !comp.name.toLowerCase().includes(search.toLowerCase()) &&
          !comp.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== 'all' && comp.category !== categoryFilter) return false;
      if (!comp.isActive) return false; // Only show active competencies
      return true;
    });
  }, [competencies, search, categoryFilter]);

  // Group by category
  const groupedCompetencies = useMemo(() => {
    return COMPETENCY_CATEGORIES.map(cat => ({
      category: cat,
      competencies: filteredCompetencies.filter(c => c.category === cat.value),
    })).filter(group => group.competencies.length > 0);
  }, [filteredCompetencies]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleSeedCompetencies = async () => {
    setIsSeedingCompetencies(true);
    const success = await seedCompetencies();
    setIsSeedingCompetencies(false);
    if (success) {
      alert('Standard Dawin competencies have been seeded successfully!');
    }
  };

  const handleFixCompetencyData = async () => {
    if (!organizationId) {
      alert('No organization ID found. Please ensure you are logged in.');
      return;
    }

    if (!confirm(`This will update all competencies with empty companyId to use: ${organizationId}\n\nContinue?`)) {
      return;
    }

    setIsFixingData(true);
    try {
      const updated = await fixCompetenciesWithEmptyCompanyId(organizationId);
      alert(`Successfully updated ${updated} competencies!`);
      // Reload competencies
      await loadCompetencies();
    } catch (error) {
      console.error('Error fixing competency data:', error);
      alert('Failed to fix competency data. Check console for details.');
    } finally {
      setIsFixingData(false);
    }
  };

  if (isLoading && competencies.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-red-600">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" style={{ color: PERFORMANCE_COLOR }} />
            Competency Framework
          </h1>
          <p className="text-muted-foreground">Define and manage organizational competencies</p>
        </div>
        <div className="flex gap-2">
          {competencies.length === 0 && (
            <>
              <Button
                variant="outline"
                onClick={handleSeedCompetencies}
                disabled={isSeedingCompetencies}
                className="border-green-600 text-green-700 hover:bg-green-50"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {isSeedingCompetencies ? 'Seeding...' : 'Seed Standard Competencies'}
              </Button>
              <Button
                variant="outline"
                onClick={handleFixCompetencyData}
                disabled={isFixingData}
                className="border-blue-600 text-blue-700 hover:bg-blue-50"
              >
                {isFixingData ? 'Fixing...' : 'Fix Existing Data'}
              </Button>
            </>
          )}
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => navigate('/hr/performance/competencies/new')} style={{ backgroundColor: PERFORMANCE_COLOR }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Competency
          </Button>
        </div>
      </div>

      {/* Proficiency Level Legend */}
      <Card>
        <CardContent className="py-3">
          <p className="text-sm font-medium mb-2">Proficiency Levels</p>
          <div className="flex flex-wrap gap-2">
            {PROFICIENCY_LEVELS.map(profLevel => (
              <Badge
                key={profLevel.level}
                variant="outline"
                style={{
                  backgroundColor: `${profLevel.color}20`,
                  borderColor: profLevel.color,
                  color: profLevel.numeric >= 4 ? profLevel.color : undefined
                }}
              >
                {profLevel.numeric}. {profLevel.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search competencies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as CompetencyCategory | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {COMPETENCY_CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Competencies by Category */}
      {competencies.length === 0 ? (
        <Card className="p-12 text-center">
          <Brain className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Competencies Defined</h3>
          <p className="text-muted-foreground mb-4">
            Get started by seeding the standard Dawin competency framework or creating your own
            custom competencies.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={handleSeedCompetencies}
              disabled={isSeedingCompetencies}
              className="border-green-600 text-green-700 hover:bg-green-50"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Seed Standard Competencies
            </Button>
            <Button onClick={() => navigate('/hr/performance/competencies/new')} style={{ backgroundColor: PERFORMANCE_COLOR }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Custom Competency
            </Button>
          </div>
        </Card>
      ) : filteredCompetencies.length === 0 ? (
        <Card className="p-12 text-center">
          <Brain className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Competencies Found</h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your filters
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {groupedCompetencies.map(group => (
            <Card key={group.category.value}>
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleCategory(group.category.value)}
              >
                <div className="flex items-center gap-3">
                  {expandedCategories.includes(group.category.value) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="font-semibold">{group.category.label}</span>
                  <Badge variant="outline">{group.competencies.length} competencies</Badge>
                </div>
              </div>
              {expandedCategories.includes(group.category.value) && (
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.competencies.map(competency => (
                      <Card
                        key={competency.id}
                        className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/hr/performance/competencies/${competency.id}`);
                        }}
                      >
                        <CardContent className="p-4">
                          <p className="font-semibold">{competency.name}</p>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {competency.description}
                          </p>

                          {/* Proficiency Levels Count */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Proficiency Levels</span>
                              <span className="font-medium">{competency.levelDefinitions.length} levels</span>
                            </div>
                          </div>

                          {/* Applicable Roles */}
                          {competency.applicableRoles && competency.applicableRoles.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Applicable to: {competency.applicableRoles.slice(0, 2).join(', ')}
                              {competency.applicableRoles.length > 2 && ` +${competency.applicableRoles.length - 2} more`}
                            </p>
                          )}
                          {(!competency.applicableRoles || competency.applicableRoles.length === 0) && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Applicable to all roles
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default CompetencyListPage;
