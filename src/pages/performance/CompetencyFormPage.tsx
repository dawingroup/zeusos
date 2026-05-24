/**
 * CompetencyFormPage.tsx
 * Form for creating/editing competencies with proficiency level definitions
 * ZeusOS v2.0 - Phase 8.9
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Brain,
  Save,
  X,
  Plus,
  Trash2,
  ArrowLeft,
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
import { Badge } from '@/core/components/ui/badge';
import { useDevelopment } from '@/modules/hr-central/performance/hooks/useDevelopment';
import { useGlobalState } from '@/integration/store';
import { useAuth } from '@/core/hooks/useAuth';
import { getOrganizationIdFromEmail } from '@/modules/hr-central/performance/utils/fixCompetencyData';
import type {
  CompetencyCategory,
  ProficiencyLevel,
  LevelDefinition,
} from '@/modules/hr-central/performance/types/development.types';

const PERFORMANCE_COLOR = '#FF5722';

// Competency categories
const COMPETENCY_CATEGORIES: Array<{ value: CompetencyCategory; label: string; description: string }> = [
  { value: 'technical', label: 'Technical Skills', description: 'Job-specific technical abilities' },
  { value: 'leadership', label: 'Leadership', description: 'Team management and leadership skills' },
  { value: 'client', label: 'Client Management', description: 'Client relationship and service skills' },
  { value: 'behavioral', label: 'Behavioral', description: 'Soft skills and behaviors' },
  { value: 'core', label: 'Core Competencies', description: 'Foundational organizational competencies' },
];

// Proficiency levels
const PROFICIENCY_LEVELS: Array<{ value: ProficiencyLevel; label: string; numeric: number }> = [
  { value: 'novice', label: 'Novice', numeric: 1 },
  { value: 'beginner', label: 'Beginner', numeric: 2 },
  { value: 'intermediate', label: 'Intermediate', numeric: 3 },
  { value: 'advanced', label: 'Advanced', numeric: 4 },
  { value: 'expert', label: 'Expert', numeric: 5 },
];

export function CompetencyFormPage() {
  const navigate = useNavigate();
  const { competencyId } = useParams();
  const { state } = useGlobalState();
  const { user } = useAuth();

  // Get organization ID from user email as fallback
  const organizationId = state.currentOrganizationId ||
    (user?.email ? getOrganizationIdFromEmail(user.email) : '');

  const {
    competencies,
    isLoading,
    error,
    createCompetency,
    updateCompetency,
  } = useDevelopment({
    companyId: organizationId,
    autoLoad: true,
  });

  const isEditMode = !!competencyId;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CompetencyCategory>('technical');
  const [applicableRoles, setApplicableRoles] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState('');
  const [levelDefinitions, setLevelDefinitions] = useState<LevelDefinition[]>([
    { level: 'novice', description: '', indicators: [''] },
    { level: 'beginner', description: '', indicators: [''] },
    { level: 'intermediate', description: '', indicators: [''] },
    { level: 'advanced', description: '', indicators: [''] },
    { level: 'expert', description: '', indicators: [''] },
  ]);

  const [isSaving, setIsSaving] = useState(false);

  // Load existing competency if editing
  useEffect(() => {
    if (isEditMode && competencyId && competencies.length > 0) {
      const competency = competencies.find(c => c.id === competencyId);
      if (competency) {
        setName(competency.name);
        setDescription(competency.description);
        setCategory(competency.category);
        setApplicableRoles(competency.applicableRoles || []);
        setLevelDefinitions(competency.levelDefinitions);
      }
    }
  }, [isEditMode, competencyId, competencies]);

  const handleAddRole = () => {
    if (roleInput.trim() && !applicableRoles.includes(roleInput.trim())) {
      setApplicableRoles([...applicableRoles, roleInput.trim()]);
      setRoleInput('');
    }
  };

  const handleRemoveRole = (role: string) => {
    setApplicableRoles(applicableRoles.filter(r => r !== role));
  };

  const handleLevelDescriptionChange = (level: ProficiencyLevel, description: string) => {
    setLevelDefinitions(prev =>
      prev.map(ld => (ld.level === level ? { ...ld, description } : ld))
    );
  };

  const handleIndicatorChange = (level: ProficiencyLevel, index: number, value: string) => {
    setLevelDefinitions(prev =>
      prev.map(ld =>
        ld.level === level
          ? {
              ...ld,
              indicators: ld.indicators.map((ind: string, i: number) => (i === index ? value : ind)),
            }
          : ld
      )
    );
  };

  const handleAddIndicator = (level: ProficiencyLevel) => {
    setLevelDefinitions(prev =>
      prev.map(ld => (ld.level === level ? { ...ld, indicators: [...ld.indicators, ''] } : ld))
    );
  };

  const handleRemoveIndicator = (level: ProficiencyLevel, index: number) => {
    setLevelDefinitions(prev =>
      prev.map(ld =>
        ld.level === level
          ? { ...ld, indicators: ld.indicators.filter((_: string, i: number) => i !== index) }
          : ld
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !description.trim()) {
      alert('Please fill in name and description');
      return;
    }

    // Validate level definitions
    const validLevelDefinitions = levelDefinitions.filter(
      ld => ld.description.trim() && ld.indicators.some((ind: string) => ind.trim())
    );

    if (validLevelDefinitions.length === 0) {
      alert('Please define at least one proficiency level with description and indicators');
      return;
    }

    // Clean up indicators
    const cleanedLevelDefinitions = validLevelDefinitions.map(ld => ({
      ...ld,
      indicators: ld.indicators.filter((ind: string) => ind.trim()),
    }));

    const competencyData: any = {
      name: name.trim(),
      description: description.trim(),
      category,
      applicableRoles: applicableRoles.length > 0 ? applicableRoles : undefined,
      levelDefinitions: cleanedLevelDefinitions,
      isActive: true,
    };

    setIsSaving(true);

    try {
      if (isEditMode && competencyId) {
        await updateCompetency(competencyId, competencyData);
      } else {
        await createCompetency(competencyData);
      }

      navigate('/hr/performance/competencies');
    } catch (err) {
      console.error('Error saving competency:', err);
      alert('Failed to save competency. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && competencies.length === 0) {
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
        <p className="text-[var(--rag-red)]">{error}</p>
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
              {isEditMode ? 'Edit Competency' : 'Add Competency'}
            </h1>
            <p className="text-muted-foreground">
              {isEditMode ? 'Update competency details' : 'Define a new organizational competency'}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate('/hr/performance/competencies')}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Competency Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Project Management"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what this competency entails..."
                rows={3}
                required
              />
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              <Select value={category} onValueChange={(val: CompetencyCategory) => setCategory(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPETENCY_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div>
                        <p className="font-medium">{cat.label}</p>
                        <p className="text-xs text-muted-foreground">{cat.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Applicable Roles */}
            <div>
              <Label>Applicable Roles (optional)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Leave empty if applicable to all roles
              </p>
              <div className="flex gap-2 mb-2">
                <Input
                  value={roleInput}
                  onChange={e => setRoleInput(e.target.value)}
                  placeholder="e.g., Project Manager"
                  onKeyPress={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddRole();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddRole}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {applicableRoles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {applicableRoles.map(role => (
                    <Badge key={role} variant="outline" className="gap-1">
                      {role}
                      <button
                        type="button"
                        onClick={() => handleRemoveRole(role)}
                        className="ml-1 hover:text-[var(--rag-red)]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Proficiency Level Definitions */}
        <Card>
          <CardHeader>
            <CardTitle>Proficiency Level Definitions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Define what each proficiency level means for this competency
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {PROFICIENCY_LEVELS.map(profLevel => {
              const levelDef = levelDefinitions.find(ld => ld.level === profLevel.value);
              if (!levelDef) return null;

              return (
                <div key={profLevel.value} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">
                      {profLevel.numeric}. {profLevel.label}
                    </h4>
                  </div>

                  <div>
                    <Label htmlFor={`level-${profLevel.value}-desc`}>Description</Label>
                    <Textarea
                      id={`level-${profLevel.value}-desc`}
                      value={levelDef.description}
                      onChange={e => handleLevelDescriptionChange(profLevel.value, e.target.value)}
                      placeholder={`What does ${profLevel.label} level look like?`}
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>Behavioral Indicators</Label>
                    <div className="space-y-2 mt-2">
                      {levelDef.indicators.map((indicator: string, index: number) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={indicator}
                            onChange={e =>
                              handleIndicatorChange(profLevel.value, index, e.target.value)
                            }
                            placeholder={`Indicator ${index + 1}`}
                          />
                          {levelDef.indicators.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => handleRemoveIndicator(profLevel.value, index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddIndicator(profLevel.value)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Indicator
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/hr/performance/competencies')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving} style={{ backgroundColor: PERFORMANCE_COLOR }}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : isEditMode ? 'Update Competency' : 'Create Competency'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default CompetencyFormPage;
