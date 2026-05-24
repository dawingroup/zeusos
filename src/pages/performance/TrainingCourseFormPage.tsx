/**
 * TrainingCourseFormPage.tsx
 * Form for creating/editing training courses with support for:
 * - External platforms (Coursera, Udemy, LinkedIn Learning)
 * - Google Drive videos
 * - CEO 1-on-1 mentorship
 * - External workshops
 * ZeusOS v2.0 - Phase 8.9
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  GraduationCap,
  Save,
  X,
  Plus,
  Trash2,
  ExternalLink,
  Video,
  User,
  Users,
  BookOpen,
  Award,
  Briefcase,
  Calendar,
  Clock,
  MapPin,
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
import type {
  TrainingType,
  TrainingProvider,
  DeliveryMethod,
} from '@/modules/hr-central/performance/types/development.types';

const PERFORMANCE_COLOR = '#FF5722';

// Training type configuration
const TRAINING_TYPES: Array<{
  value: TrainingType;
  label: string;
  icon: any;
  color: string;
  description: string;
}> = [
  {
    value: 'external_course',
    label: 'External Course',
    icon: ExternalLink,
    color: 'text-[var(--rag-blue)]',
    description: 'Courses from platforms like Coursera, Udemy, LinkedIn Learning',
  },
  {
    value: 'e_learning',
    label: 'Video/E-Learning',
    icon: Video,
    color: 'text-[var(--rag-blue)]',
    description: 'Video content from Google Drive or other sources',
  },
  {
    value: 'mentorship',
    label: '1-on-1 Mentorship',
    icon: User,
    color: 'text-[var(--rag-red)]',
    description: 'Personal mentorship sessions (e.g., with CEO)',
  },
  {
    value: 'workshop',
    label: 'Workshop',
    icon: Users,
    color: 'text-[var(--rag-amber)]',
    description: 'In-person or virtual workshops with external trainers',
  },
  {
    value: 'internal_course',
    label: 'Internal Course',
    icon: BookOpen,
    color: 'text-[var(--rag-green)]',
    description: 'Company-developed training materials',
  },
  {
    value: 'certification',
    label: 'Certification',
    icon: Award,
    color: 'text-[var(--rag-blue)]',
    description: 'Professional certification programs',
  },
  {
    value: 'on_the_job',
    label: 'On-the-Job Training',
    icon: Briefcase,
    color: 'text-[var(--rag-blue)]',
    description: 'Hands-on learning through work assignments',
  },
];

const PROVIDERS: Array<{ value: TrainingProvider; label: string }> = [
  { value: 'internal', label: 'Internal (Dawin)' },
  { value: 'external', label: 'External Platform (Coursera, Udemy, etc.)' },
  { value: 'vendor', label: 'External Vendor/Trainer' },
];

const DELIVERY_METHODS: Array<{ value: DeliveryMethod; label: string }> = [
  { value: 'online', label: 'Online' },
  { value: 'classroom', label: 'Classroom' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'self_paced', label: 'Self-Paced' },
];

export function TrainingCourseFormPage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const { state } = useGlobalState();

  const {
    trainingCourses,
    competencies,
    isLoading,
    error,
    createTrainingCourse,
    updateTrainingCourse,
  } = useDevelopment({
    companyId: state.currentOrganizationId || '',
    autoLoad: true,
  });

  const isEditMode = !!courseId;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [trainingType, setTrainingType] = useState<TrainingType>('external_course');
  const [provider, setProvider] = useState<TrainingProvider>('external');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('online');
  const [duration, setDuration] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [mentorId, setMentorId] = useState('');
  const [workshopDate, setWorkshopDate] = useState('');
  const [workshopTime, setWorkshopTime] = useState('');
  const [workshopLocation, setWorkshopLocation] = useState('');
  const [trainerName, setTrainerName] = useState('');
  const [trainerContact, setTrainerContact] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [learningObjectives, setLearningObjectives] = useState<string[]>(['']);
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>([]);
  const [cost, setCost] = useState('');
  const [certificateOffered, setCertificateOffered] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  // Load existing course if editing
  useEffect(() => {
    if (isEditMode && courseId && trainingCourses.length > 0) {
      const course = trainingCourses.find(c => c.id === courseId);
      if (course) {
        setTitle(course.title);
        setDescription(course.description);
        if (course.trainingType) setTrainingType(course.trainingType as TrainingType);
        setProvider(course.provider);
        setDeliveryMethod(course.deliveryMethod);
        setDuration(course.duration.toString());
        setExternalUrl(course.externalUrl || '');
        setVideoUrl(course.videoUrl || '');
        setLearningObjectives(course.learningObjectives);
        setSelectedCompetencies(course.targetCompetencies);
        setCost(course.cost?.toString() || '');
        setCertificateOffered(course.certificateOffered || false);

        // Load type-specific fields
        if (course.mentorId) setMentorId(course.mentorId);
        if (course.workshopDetails) {
          setWorkshopDate(String(course.workshopDetails.date || ''));
          setWorkshopTime(course.workshopDetails.time || '');
          setWorkshopLocation(course.workshopDetails.location || '');
          setTrainerName(course.workshopDetails.trainerName || '');
          setTrainerContact(course.workshopDetails.trainerContact || '');
        }
        if (course.maxParticipants) setMaxParticipants(course.maxParticipants.toString());
      }
    }
  }, [isEditMode, courseId, trainingCourses]);

  const handleAddObjective = () => {
    setLearningObjectives([...learningObjectives, '']);
  };

  const handleRemoveObjective = (index: number) => {
    setLearningObjectives(learningObjectives.filter((_, i) => i !== index));
  };

  const handleObjectiveChange = (index: number, value: string) => {
    const updated = [...learningObjectives];
    updated[index] = value;
    setLearningObjectives(updated);
  };

  const handleToggleCompetency = (competencyId: string) => {
    setSelectedCompetencies(prev =>
      prev.includes(competencyId)
        ? prev.filter(id => id !== competencyId)
        : [...prev, competencyId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      alert('Please fill in title and description');
      return;
    }

    if (selectedCompetencies.length === 0) {
      alert('Please select at least one target competency');
      return;
    }

    const courseData: any = {
      title: title.trim(),
      description: description.trim(),
      trainingType,
      provider,
      deliveryMethod,
      duration: parseInt(duration) || 0,
      learningObjectives: learningObjectives.filter(obj => obj.trim().length > 0),
      targetCompetencies: selectedCompetencies,
      cost: cost ? parseFloat(cost) : undefined,
      certificateOffered,
      isActive: true,
    };

    // Add type-specific fields
    if (trainingType === 'external_course' && externalUrl) {
      courseData.externalUrl = externalUrl;
    }

    if (trainingType === 'e_learning' && videoUrl) {
      courseData.videoUrl = videoUrl;
    }

    if (trainingType === 'mentorship' && mentorId) {
      courseData.mentorId = mentorId;
    }

    if (trainingType === 'workshop') {
      courseData.workshopDetails = {
        date: workshopDate || undefined,
        time: workshopTime || undefined,
        location: workshopLocation || undefined,
        trainerName: trainerName || undefined,
        trainerContact: trainerContact || undefined,
      };
    }

    if (maxParticipants) {
      courseData.maxParticipants = parseInt(maxParticipants);
    }

    setIsSaving(true);

    try {
      if (isEditMode && courseId) {
        await updateTrainingCourse(courseId, courseData);
      } else {
        await createTrainingCourse(courseData);
      }

      navigate('/hr/performance/training');
    } catch (err) {
      console.error('Error saving course:', err);
      alert('Failed to save course. Please try again.');
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

  const selectedTypeConfig = TRAINING_TYPES.find(t => t.value === trainingType);
  // TypeIcon available via: selectedTypeConfig?.icon || GraduationCap

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6" style={{ color: PERFORMANCE_COLOR }} />
            {isEditMode ? 'Edit Training Course' : 'Add Training Course'}
          </h1>
          <p className="text-muted-foreground">
            {isEditMode ? 'Update course details' : 'Create a new training course'}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/hr/performance/training')}>
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
              <Label htmlFor="title">Course Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Advanced Project Management"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what participants will learn..."
                rows={4}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="duration">Duration (hours) *</Label>
                <Input
                  id="duration"
                  type="number"
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  placeholder="e.g., 8"
                  required
                />
              </div>

              <div>
                <Label htmlFor="cost">Cost ($)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={cost}
                  onChange={e => setCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Training Type & Delivery */}
        <Card>
          <CardHeader>
            <CardTitle>Training Type & Delivery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="trainingType">Training Type *</Label>
              <Select value={trainingType} onValueChange={(val: TrainingType) => setTrainingType(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRAINING_TYPES.map(type => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${type.color}`} />
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {selectedTypeConfig && (
                <p className="text-xs text-muted-foreground mt-1">{selectedTypeConfig.description}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="provider">Provider *</Label>
                <Select value={provider} onValueChange={(val: TrainingProvider) => setProvider(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="deliveryMethod">Delivery Method *</Label>
                <Select
                  value={deliveryMethod}
                  onValueChange={(val: DeliveryMethod) => setDeliveryMethod(val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERY_METHODS.map(dm => (
                      <SelectItem key={dm.value} value={dm.value}>
                        {dm.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Type-Specific Fields */}
        {trainingType === 'external_course' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5 text-[var(--rag-blue)]" />
                External Platform Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="externalUrl">Course URL</Label>
                <Input
                  id="externalUrl"
                  type="url"
                  value={externalUrl}
                  onChange={e => setExternalUrl(e.target.value)}
                  placeholder="https://www.coursera.org/learn/..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Link to the course on Coursera, Udemy, LinkedIn Learning, etc.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {trainingType === 'e_learning' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-[var(--rag-blue)]" />
                Video/E-Learning Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="videoUrl">Video URL or Google Drive Link</Label>
                <Input
                  id="videoUrl"
                  type="url"
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Link to video content stored in Google Drive or other platforms
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {trainingType === 'mentorship' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-[var(--rag-red)]" />
                Mentorship Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="mentorId">Mentor ID (Employee ID)</Label>
                <Input
                  id="mentorId"
                  value={mentorId}
                  onChange={e => setMentorId(e.target.value)}
                  placeholder="e.g., CEO's employee ID"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Employee ID of the mentor (e.g., CEO for CEO 1-on-1 sessions)
                </p>
              </div>

              <div>
                <Label htmlFor="maxParticipants">Max Participants</Label>
                <Input
                  id="maxParticipants"
                  type="number"
                  value={maxParticipants}
                  onChange={e => setMaxParticipants(e.target.value)}
                  placeholder="1"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {trainingType === 'workshop' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[var(--rag-amber)]" />
                Workshop Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="workshopDate">Workshop Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="workshopDate"
                      type="date"
                      value={workshopDate}
                      onChange={e => setWorkshopDate(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="workshopTime">Workshop Time</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="workshopTime"
                      type="time"
                      value={workshopTime}
                      onChange={e => setWorkshopTime(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="workshopLocation">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="workshopLocation"
                    value={workshopLocation}
                    onChange={e => setWorkshopLocation(e.target.value)}
                    placeholder="e.g., Main Office - Conference Room A"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="trainerName">External Trainer Name</Label>
                  <Input
                    id="trainerName"
                    value={trainerName}
                    onChange={e => setTrainerName(e.target.value)}
                    placeholder="e.g., John Doe"
                  />
                </div>

                <div>
                  <Label htmlFor="trainerContact">Trainer Contact</Label>
                  <Input
                    id="trainerContact"
                    value={trainerContact}
                    onChange={e => setTrainerContact(e.target.value)}
                    placeholder="email@example.com or phone"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="maxParticipants">Max Participants</Label>
                <Input
                  id="maxParticipants"
                  type="number"
                  value={maxParticipants}
                  onChange={e => setMaxParticipants(e.target.value)}
                  placeholder="e.g., 20"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Learning Objectives */}
        <Card>
          <CardHeader>
            <CardTitle>Learning Objectives</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {learningObjectives.map((objective, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={objective}
                  onChange={e => handleObjectiveChange(index, e.target.value)}
                  placeholder={`Objective ${index + 1}`}
                />
                {learningObjectives.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleRemoveObjective(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={handleAddObjective}>
              <Plus className="h-4 w-4 mr-2" />
              Add Objective
            </Button>
          </CardContent>
        </Card>

        {/* Target Competencies */}
        <Card>
          <CardHeader>
            <CardTitle>Target Competencies *</CardTitle>
            <p className="text-sm text-muted-foreground">
              Select the competencies this course helps develop
            </p>
          </CardHeader>
          <CardContent>
            {competencies.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No competencies available. Please create competencies first.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {competencies
                  .filter(c => c.isActive)
                  .map(competency => (
                    <div
                      key={competency.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedCompetencies.includes(competency.id)
                          ? 'border-[var(--rag-blue)] bg-[var(--rag-blue-soft)]'
                          : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'
                      }`}
                      onClick={() => handleToggleCompetency(competency.id)}
                    >
                      <p className="font-medium text-sm">{competency.name}</p>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {competency.category}
                      </Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/hr/performance/training')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving} style={{ backgroundColor: PERFORMANCE_COLOR }}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : isEditMode ? 'Update Course' : 'Create Course'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default TrainingCourseFormPage;
