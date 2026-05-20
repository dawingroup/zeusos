/**
 * DevelopmentPlanFormPage.tsx
 * Form for creating/editing employee development plans
 * DawinOS v2.0 - Phase 8.9
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Target,
  Save,
  X,
  Plus,
  Trash2,
  ArrowLeft,
  TrendingUp,
  Award,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
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
import type {
  DevelopmentGoal,
  ProficiencyLevel,
} from '@/modules/hr-central/performance/types/development.types';

const PERFORMANCE_COLOR = '#FF5722';

const GOAL_STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const PROFICIENCY_LEVELS: Array<{ value: ProficiencyLevel; label: string; numeric: number }> = [
  { value: 'novice', label: 'Novice', numeric: 1 },
  { value: 'beginner', label: 'Beginner', numeric: 2 },
  { value: 'intermediate', label: 'Intermediate', numeric: 3 },
  { value: 'advanced', label: 'Advanced', numeric: 4 },
  { value: 'expert', label: 'Expert', numeric: 5 },
];

export function DevelopmentPlanFormPage() {
  const navigate = useNavigate();
  const { planId } = useParams();
  const { state } = useGlobalState();

  const {
    developmentPlans,
    competencies,
    isLoading,
    error,
    createDevelopmentPlan,
    updateDevelopmentPlan,
  } = useDevelopment({
    companyId: state.currentOrganizationId || '',
    employeeId: state.auth.user?.userId,
    autoLoad: true,
  });

  const isEditMode = !!planId;

  // Form state
  const [planYear, setPlanYear] = useState(new Date().getFullYear());
  const [desiredRole, setDesiredRole] = useState('');
  const [careerGoals, setCareerGoals] = useState('');
  const [goals, setGoals] = useState<DevelopmentGoal[]>([]);
  const [skillGaps, setSkillGaps] = useState<
    Array<{
      competencyId: string;
      currentLevel: ProficiencyLevel;
      targetLevel: ProficiencyLevel;
      priority: 'high' | 'medium' | 'low';
    }>
  >([]);
  const [strengths, setStrengths] = useState<string[]>(['']);

  const [isSaving, setIsSaving] = useState(false);

  // Load existing plan if editing
  useEffect(() => {
    if (isEditMode && planId && developmentPlans.length > 0) {
      const plan = developmentPlans.find(p => p.id === planId);
      if (plan) {
        setPlanYear(plan.planYear);
        setDesiredRole(plan.desiredRole || '');
        setCareerGoals(plan.careerGoals || '');
        setGoals(plan.goals);
        setSkillGaps(plan.skillGaps);
        setStrengths(plan.strengths || ['']);
      }
    }
  }, [isEditMode, planId, developmentPlans]);

  const handleAddGoal = () => {
    const newGoal = {
      id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: '',
      description: '',
      targetDate: new Date(),
      status: 'draft' as const,
    } as DevelopmentGoal;
    setGoals([...goals, newGoal]);
  };

  const handleRemoveGoal = (goalId: string) => {
    setGoals(goals.filter(g => g.id !== goalId));
  };

  const handleGoalChange = (goalId: string, field: keyof DevelopmentGoal, value: any) => {
    setGoals(
      goals.map(g =>
        g.id === goalId ? { ...g, [field]: value, updatedAt: new Date() } : g
      )
    );
  };

  const handleAddSkillGap = () => {
    setSkillGaps([
      ...skillGaps,
      {
        competencyId: '',
        currentLevel: 'novice',
        targetLevel: 'intermediate',
        priority: 'medium',
      },
    ]);
  };

  const handleRemoveSkillGap = (index: number) => {
    setSkillGaps(skillGaps.filter((_, i) => i !== index));
  };

  const handleSkillGapChange = (index: number, field: string, value: any) => {
    setSkillGaps(
      skillGaps.map((gap, i) => (i === index ? { ...gap, [field]: value } : gap))
    );
  };

  const handleStrengthChange = (index: number, value: string) => {
    const updated = [...strengths];
    updated[index] = value;
    setStrengths(updated);
  };

  const handleAddStrength = () => {
    setStrengths([...strengths, '']);
  };

  const handleRemoveStrength = (index: number) => {
    setStrengths(strengths.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (goals.length === 0) {
      alert('Please add at least one development goal');
      return;
    }

    // Validate goals
    const validGoals = goals.filter(g => g.title.trim());
    if (validGoals.length === 0) {
      alert('Please provide titles for all goals');
      return;
    }

    // Validate skill gaps
    const validSkillGaps = skillGaps.filter(sg => sg.competencyId);

    const planData: any = {
      planYear,
      desiredRole: desiredRole.trim() || undefined,
      careerGoals: careerGoals.trim() || undefined,
      goals: validGoals,
      skillGaps: validSkillGaps,
      strengths: strengths.filter(s => s.trim()),
      overallProgress: 0,
    };

    setIsSaving(true);

    try {
      if (isEditMode && planId) {
        await updateDevelopmentPlan(planId, planData);
      } else {
        await createDevelopmentPlan(planData);
      }

      navigate('/hr/performance/development');
    } catch (err) {
      console.error('Error saving development plan:', err);
      alert('Failed to save development plan. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && developmentPlans.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32" />
        ))}
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
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/hr/performance/development')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6" style={{ color: PERFORMANCE_COLOR }} />
              {isEditMode ? 'Edit Development Plan' : 'Create Development Plan'}
            </h1>
            <p className="text-muted-foreground">
              {isEditMode ? 'Update your development plan' : 'Plan your professional growth'}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate('/hr/performance/development')}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="planYear">Plan Year *</Label>
                <Input
                  id="planYear"
                  type="number"
                  value={planYear}
                  onChange={e => setPlanYear(parseInt(e.target.value))}
                  min={2020}
                  max={2050}
                  required
                />
              </div>

              <div>
                <Label htmlFor="desiredRole">Desired Role (optional)</Label>
                <Input
                  id="desiredRole"
                  value={desiredRole}
                  onChange={e => setDesiredRole(e.target.value)}
                  placeholder="e.g., Senior Project Manager"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="careerGoals">Career Goals (optional)</Label>
              <Textarea
                id="careerGoals"
                value={careerGoals}
                onChange={e => setCareerGoals(e.target.value)}
                placeholder="Describe your long-term career aspirations..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Development Goals */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Development Goals *</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Set specific objectives for this development period
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddGoal}>
                <Plus className="h-4 w-4 mr-2" />
                Add Goal
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {goals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No goals added yet. Click "Add Goal" to get started.
              </p>
            ) : (
              goals.map((goal, index) => (
                <div key={goal.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Goal {index + 1}</h4>
                    {goals.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveGoal(goal.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`goal-${goal.id}-title`}>Title *</Label>
                      <Input
                        id={`goal-${goal.id}-title`}
                        value={goal.title}
                        onChange={e => handleGoalChange(goal.id, 'title', e.target.value)}
                        placeholder="Goal title"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor={`goal-${goal.id}-status`}>Status</Label>
                      <Select
                        value={goal.status}
                        onValueChange={value => handleGoalChange(goal.id, 'status', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GOAL_STATUS_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`goal-${goal.id}-description`}>Description</Label>
                    <Textarea
                      id={`goal-${goal.id}-description`}
                      value={goal.description}
                      onChange={e => handleGoalChange(goal.id, 'description', e.target.value)}
                      placeholder="Describe this goal..."
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor={`goal-${goal.id}-targetDate`}>Target Date</Label>
                    <Input
                      id={`goal-${goal.id}-targetDate`}
                      type="date"
                      value={
                        goal.targetDate instanceof Date
                          ? goal.targetDate.toISOString().split('T')[0]
                          : goal.targetDate
                            ? new Date(goal.targetDate as any).toISOString().split('T')[0]
                            : ''
                      }
                      onChange={e =>
                        handleGoalChange(goal.id, 'targetDate', new Date(e.target.value))
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Skill Gaps */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Skill Gaps
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Identify competencies to develop
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddSkillGap}>
                <Plus className="h-4 w-4 mr-2" />
                Add Skill Gap
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {skillGaps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No skill gaps identified yet.
              </p>
            ) : (
              skillGaps.map((gap, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-medium">Skill Gap {index + 1}</h5>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSkillGap(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Competency *</Label>
                      <Select
                        value={gap.competencyId}
                        onValueChange={value => handleSkillGapChange(index, 'competencyId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select competency" />
                        </SelectTrigger>
                        <SelectContent>
                          {competencies
                            .filter(c => c.isActive)
                            .map(comp => (
                              <SelectItem key={comp.id} value={comp.id}>
                                {comp.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Priority</Label>
                      <Select
                        value={gap.priority}
                        onValueChange={value => handleSkillGapChange(index, 'priority', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Current Level</Label>
                      <Select
                        value={gap.currentLevel}
                        onValueChange={value =>
                          handleSkillGapChange(index, 'currentLevel', value as ProficiencyLevel)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROFICIENCY_LEVELS.map(level => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.numeric}. {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Target Level</Label>
                      <Select
                        value={gap.targetLevel}
                        onValueChange={value =>
                          handleSkillGapChange(index, 'targetLevel', value as ProficiencyLevel)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROFICIENCY_LEVELS.map(level => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.numeric}. {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Strengths */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Strengths
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Highlight your key strengths and achievements
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddStrength}>
                <Plus className="h-4 w-4 mr-2" />
                Add Strength
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {strengths.map((strength, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={strength}
                  onChange={e => handleStrengthChange(index, e.target.value)}
                  placeholder={`Strength ${index + 1}`}
                />
                {strengths.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleRemoveStrength(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/hr/performance/development')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving} style={{ backgroundColor: PERFORMANCE_COLOR }}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : isEditMode ? 'Update Plan' : 'Create Plan'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default DevelopmentPlanFormPage;
