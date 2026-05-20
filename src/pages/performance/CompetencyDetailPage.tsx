/**
 * CompetencyDetailPage.tsx
 * Detailed view of a competency with level definitions and assessment capability
 * DawinOS v2.0 - Phase 8.9
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Brain,
  CheckCircle,
  Target,
  Users,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Skeleton } from '@/core/components/ui/skeleton';
import { useDevelopment } from '@/modules/hr-central/performance/hooks/useDevelopment';
import { useGlobalState } from '@/integration/store';
import { useAuth } from '@/core/hooks/useAuth';
import { getOrganizationIdFromEmail } from '@/modules/hr-central/performance/utils/fixCompetencyData';
import type { ProficiencyLevel } from '@/modules/hr-central/performance/types/development.types';

const PERFORMANCE_COLOR = '#FF5722';

// Proficiency level colors
const LEVEL_COLORS: Record<number, string> = {
  1: '#e0e0e0',
  2: '#90caf9',
  3: '#66bb6a',
  4: '#ffa726',
  5: '#ab47bc',
};

const LEVEL_LABELS: Record<ProficiencyLevel, { label: string; numeric: number }> = {
  novice: { label: 'Novice', numeric: 1 },
  beginner: { label: 'Beginner', numeric: 2 },
  intermediate: { label: 'Intermediate', numeric: 3 },
  advanced: { label: 'Advanced', numeric: 4 },
  expert: { label: 'Expert', numeric: 5 },
};

export function CompetencyDetailPage() {
  const navigate = useNavigate();
  const { competencyId } = useParams();
  const { state } = useGlobalState();
  const { user } = useAuth();

  // Get organization ID from user email as fallback
  const organizationId = state.currentOrganizationId ||
    (user?.email ? getOrganizationIdFromEmail(user.email) : '');

  const {
    competencies,
    trainingCourses,
    isLoading,
    error,
    deleteCompetency,
  } = useDevelopment({
    companyId: organizationId,
    autoLoad: true,
  });

  const [isDeleting, setIsDeleting] = useState(false);

  const competency = competencies.find(c => c.id === competencyId);

  // Find training courses that target this competency
  const relatedCourses = trainingCourses.filter(course =>
    course.targetCompetencies.includes(competencyId || '')
  );

  const handleDelete = async () => {
    if (!competencyId) return;

    if (!confirm('Are you sure you want to delete this competency? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteCompetency(competencyId);
      navigate('/hr/performance/competencies');
    } catch (err) {
      console.error('Failed to delete competency:', err);
      alert('Failed to delete competency');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading && competencies.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
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

  if (!competency) {
    return (
      <Card className="p-12 text-center">
        <Brain className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Competency Not Found</h3>
        <p className="text-muted-foreground mb-4">
          The competency you're looking for doesn't exist.
        </p>
        <Button onClick={() => navigate('/hr/performance/competencies')}>
          Back to Competencies
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/hr/performance/competencies')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6" style={{ color: PERFORMANCE_COLOR }} />
              {competency.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{competency.category}</Badge>
              <Badge variant="outline" className={competency.isActive ? 'text-green-600' : 'text-gray-600'}>
                {competency.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/hr/performance/competencies/${competencyId}/edit`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{competency.description}</p>
            </CardContent>
          </Card>

          {/* Proficiency Levels */}
          <Card>
            <CardHeader>
              <CardTitle>Proficiency Levels</CardTitle>
              <p className="text-sm text-muted-foreground">
                {competency.levelDefinitions.length} levels defined
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {competency.levelDefinitions
                .sort((a, b) => LEVEL_LABELS[a.level].numeric - LEVEL_LABELS[b.level].numeric)
                .map(levelDef => {
                  const levelInfo = LEVEL_LABELS[levelDef.level];
                  const levelColor = LEVEL_COLORS[levelInfo.numeric];

                  return (
                    <div
                      key={levelDef.level}
                      className="border rounded-lg p-4"
                      style={{ borderLeftWidth: '4px', borderLeftColor: levelColor }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant="outline"
                          style={{
                            backgroundColor: `${levelColor}20`,
                            borderColor: levelColor,
                            color: levelInfo.numeric >= 4 ? levelColor : undefined,
                          }}
                        >
                          {levelInfo.numeric}. {levelInfo.label}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">{levelDef.description}</p>

                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Behavioral Indicators:
                        </p>
                        <ul className="space-y-1">
                          {levelDef.indicators.map((indicator, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              <CheckCircle className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>{indicator}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Applicable Roles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Applicable Roles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!competency.applicableRoles || competency.applicableRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground">Applicable to all roles</p>
              ) : (
                <div className="space-y-2">
                  {competency.applicableRoles.map(role => (
                    <Badge key={role} variant="outline" className="mr-2 mb-2">
                      {role}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related Training */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Related Training
              </CardTitle>
            </CardHeader>
            <CardContent>
              {relatedCourses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No training courses target this competency
                </p>
              ) : (
                <div className="space-y-2">
                  {relatedCourses.map(course => (
                    <div
                      key={course.id}
                      className="p-2 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/hr/performance/training/${course.id}`)}
                    >
                      <p className="text-sm font-medium">{course.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {course.duration} hours • {course.deliveryMethod}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate(`/hr/performance/competencies/${competencyId}/edit`)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Competency
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/hr/performance/training/new')}
              >
                <Target className="h-4 w-4 mr-2" />
                Create Training Course
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default CompetencyDetailPage;
