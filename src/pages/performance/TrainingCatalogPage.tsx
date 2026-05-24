/**
 * TrainingCatalogPage.tsx
 * Training catalog with external platforms, videos, and in-person sessions
 * ZeusOS v2.0 - Performance Module
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  BookOpen,
  Video,
  Users,
  ExternalLink,
  Calendar,
  Clock,
  Award,
  User,
  Building,
} from 'lucide-react';

import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Badge } from '@/core/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
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
import type { TrainingType } from '@/modules/hr-central/performance/types/development.types';

const PERFORMANCE_COLOR = '#FF5722';

// Training type configuration with icons and colors
const TRAINING_TYPE_CONFIG: Record<
  TrainingType,
  { label: string; icon: any; color: string; bgColor: string; description: string }
> = {
  external_course: {
    label: 'External Course',
    icon: ExternalLink,
    color: 'text-[var(--rag-blue)]',
    bgColor: 'bg-[var(--rag-blue-soft)]',
    description: 'Courses from platforms like Coursera, Udemy, LinkedIn Learning',
  },
  internal_course: {
    label: 'Internal Course',
    icon: BookOpen,
    color: 'text-[var(--rag-green)]',
    bgColor: 'bg-[var(--rag-green-soft)]',
    description: 'Company-developed training materials and courses',
  },
  certification: {
    label: 'Certification',
    icon: Award,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    description: 'Professional certifications (PMP, CFA, AWS, etc.)',
  },
  workshop: {
    label: 'Workshop',
    icon: Users,
    color: 'text-[var(--rag-amber)]',
    bgColor: 'bg-[var(--rag-amber-soft)]',
    description: 'In-person or virtual workshops with external trainers',
  },
  mentorship: {
    label: '1-on-1 Mentorship',
    icon: User,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    description: 'Personal mentorship sessions (e.g., with CEO)',
  },
  on_the_job: {
    label: 'On-the-Job',
    icon: Building,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    description: 'Learning through hands-on work and projects',
  },
  e_learning: {
    label: 'Video/E-Learning',
    icon: Video,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    description: 'Video content from Google Drive or other sources',
  },
};

// Provider options
const PROVIDER_OPTIONS = [
  { value: 'internal', label: 'Internal' },
  { value: 'external', label: 'External Platform' },
  { value: 'vendor', label: 'External Vendor/Trainer' },
];

// Delivery method options
const DELIVERY_OPTIONS = [
  { value: 'online', label: 'Online' },
  { value: 'classroom', label: 'Classroom' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'self_paced', label: 'Self-Paced' },
];

export function TrainingCatalogPage() {
  const navigate = useNavigate();
  const { state } = useGlobalState();

  const {
    trainingCourses,
    employeeTraining,
    trainingStats,
    isLoading,
    error,
    enrollInTraining,
  } = useDevelopment({
    companyId: state.currentOrganizationId || '',
    employeeId: state.auth.user?.userId,
    autoLoad: true,
  });

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TrainingType | 'all'>('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'all' | 'enrolled' | 'recommended'>('all');

  // Get enrolled course IDs
  const enrolledCourseIds = useMemo(() => {
    return new Set(employeeTraining.map(t => t.courseId));
  }, [employeeTraining]);

  // Filter courses
  const filteredCourses = useMemo(() => {
    let courses = trainingCourses;

    // Tab filter
    if (activeTab === 'enrolled') {
      courses = courses.filter(c => enrolledCourseIds.has(c.id));
    }
    // Note: 'recommended' tab would filter by competency gaps - implement when needed

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      courses = courses.filter(
        c =>
          c.title.toLowerCase().includes(searchLower) ||
          c.description.toLowerCase().includes(searchLower)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      courses = courses.filter(c => c.type === typeFilter);
    }

    // Provider filter
    if (providerFilter !== 'all') {
      courses = courses.filter(c => c.provider === providerFilter);
    }

    // Delivery filter
    if (deliveryFilter !== 'all') {
      courses = courses.filter(c => c.deliveryMethod === deliveryFilter);
    }

    return courses;
  }, [trainingCourses, search, typeFilter, providerFilter, deliveryFilter, activeTab, enrolledCourseIds]);

  // Group courses by type
  const groupedCourses = useMemo(() => {
    const groups: Record<TrainingType, typeof trainingCourses> = {
      external_course: [],
      internal_course: [],
      certification: [],
      workshop: [],
      mentorship: [],
      on_the_job: [],
      e_learning: [],
    };

    filteredCourses.forEach(course => {
      groups[course.type].push(course);
    });

    return groups;
  }, [filteredCourses]);

  const handleEnroll = async (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await enrollInTraining(courseId);
    if (success) {
      alert('Successfully enrolled in the course!');
    }
  };

  if (isLoading && trainingCourses.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
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
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" style={{ color: PERFORMANCE_COLOR }} />
            Training Catalog
          </h1>
          <p className="text-muted-foreground">
            Browse courses, certifications, workshops, and mentorship opportunities
          </p>
        </div>
        <Button
          onClick={() => navigate('/hr/performance/training/new')}
          style={{ backgroundColor: PERFORMANCE_COLOR }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Course
        </Button>
      </div>

      {/* Training Stats */}
      {trainingStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="text-center p-3">
            <p className="text-2xl font-bold">{trainingStats.total}</p>
            <p className="text-xs text-muted-foreground">Total Enrollments</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-2xl font-bold text-[var(--rag-green)]">{trainingStats.completed}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-2xl font-bold text-[var(--rag-blue)]">{trainingStats.inProgress}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-2xl font-bold text-[var(--rag-amber)]">{trainingStats.certificationsEarned}</p>
            <p className="text-xs text-muted-foreground">Certifications</p>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList>
          <TabsTrigger value="all">All Courses ({trainingCourses.length})</TabsTrigger>
          <TabsTrigger value="enrolled">My Enrollments ({enrolledCourseIds.size})</TabsTrigger>
          <TabsTrigger value="recommended">Recommended</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search training catalog..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Training Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {(Object.keys(TRAINING_TYPE_CONFIG) as TrainingType[]).map(type => (
              <SelectItem key={type} value={type}>
                {TRAINING_TYPE_CONFIG[type].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Providers</SelectItem>
            {PROVIDER_OPTIONS.map(p => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Delivery" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            {DELIVERY_OPTIONS.map(d => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Empty State */}
      {trainingCourses.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Training Courses Yet</h3>
          <p className="text-muted-foreground mb-6">
            Build your training catalog by adding courses from external platforms, internal
            materials, or scheduling workshops and mentorship sessions.
          </p>
          <Button
            onClick={() => navigate('/hr/performance/training/new')}
            style={{ backgroundColor: PERFORMANCE_COLOR }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add First Course
          </Button>
        </Card>
      ) : filteredCourses.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Courses Found</h3>
          <p className="text-muted-foreground">Try adjusting your filters</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Training courses grouped by type */}
          {(Object.keys(TRAINING_TYPE_CONFIG) as TrainingType[]).map(type => {
            const typeCourses = groupedCourses[type];
            if (typeCourses.length === 0) return null;

            const config = TRAINING_TYPE_CONFIG[type];
            const Icon = config.icon;

            return (
              <div key={type}>
                <div className={`${config.bgColor} px-4 py-3 rounded-t-lg border-b border-[var(--border-subtle)]`}>
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${config.color}`} />
                    <div className="flex-1">
                      <h2 className={`text-lg font-semibold ${config.color}`}>
                        {config.label}
                      </h2>
                      <p className="text-sm text-muted-foreground">{config.description}</p>
                    </div>
                    <span className="text-sm text-muted-foreground">{typeCourses.length} course{typeCourses.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-card rounded-b-lg border border-t-0 border-[var(--border-subtle)]">
                  {typeCourses.map(course => {
                    const isEnrolled = enrolledCourseIds.has(course.id);
                    const enrollment = employeeTraining.find(t => t.courseId === course.id);

                    return (
                      <Card
                        key={course.id}
                        className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => navigate(`/hr/performance/training/${course.id}`)}
                      >
                        <CardContent className="p-4">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold line-clamp-2">{course.title}</h3>
                              {course.provider && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {course.provider === 'external' && 'External Platform'}
                                  {course.provider === 'internal' && 'Internal'}
                                  {course.provider === 'vendor' && 'External Vendor'}
                                </p>
                              )}
                            </div>
                            {isEnrolled && (
                              <Badge className="bg-[var(--rag-green-soft)] text-[var(--rag-green)] text-xs shrink-0 ml-2">
                                Enrolled
                              </Badge>
                            )}
                          </div>

                          {/* Description */}
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {course.description}
                          </p>

                          {/* Details */}
                          <div className="space-y-2 mb-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{course.duration} hours</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              <span className="capitalize">{course.deliveryMethod.replace('_', ' ')}</span>
                            </div>
                            {course.targetCompetencies.length > 0 && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Award className="w-3 h-3" />
                                <span>{course.targetCompetencies.length} competenc{course.targetCompetencies.length === 1 ? 'y' : 'ies'}</span>
                              </div>
                            )}
                          </div>

                          {/* Learning Objectives */}
                          {course.learningObjectives.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Learning Objectives:</p>
                              <ul className="text-xs text-muted-foreground space-y-1">
                                {course.learningObjectives.slice(0, 2).map((obj, idx) => (
                                  <li key={idx} className="line-clamp-1">• {obj}</li>
                                ))}
                                {course.learningObjectives.length > 2 && (
                                  <li className="text-muted-foreground">+ {course.learningObjectives.length - 2} more</li>
                                )}
                              </ul>
                            </div>
                          )}

                          {/* Action */}
                          {isEnrolled ? (
                            enrollment && (
                              <div className="pt-3 border-t">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Progress</span>
                                  <span className="font-medium">{enrollment.progress}%</span>
                                </div>
                                <div className="w-full bg-[var(--bg-sunken)] rounded-full h-2 mt-1">
                                  <div
                                    className="bg-[var(--rag-blue)] h-2 rounded-full"
                                    style={{ width: `${enrollment.progress}%` }}
                                  />
                                </div>
                              </div>
                            )
                          ) : (
                            <Button
                              onClick={(e) => handleEnroll(course.id, e)}
                              className="w-full mt-2"
                              variant="outline"
                              size="sm"
                            >
                              Enroll Now
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TrainingCatalogPage;
