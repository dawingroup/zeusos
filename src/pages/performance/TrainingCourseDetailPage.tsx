/**
 * TrainingCourseDetailPage.tsx
 * Detailed view of a training course with enrollment management
 * DawinOS v2.0 - Phase 8.9
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Trash2,
  ExternalLink,
  Video,
  User,
  Users,
  BookOpen,
  Award,
  Briefcase,
  Clock,
  Calendar,
  MapPin,
  DollarSign,
  CheckCircle,
  PlayCircle,
  Target,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Skeleton } from '@/core/components/ui/skeleton';
import { Progress } from '@/core/components/ui/progress';
import { useDevelopment } from '@/modules/hr-central/performance/hooks/useDevelopment';
import { useGlobalState } from '@/integration/store';
import type { TrainingType } from '@/modules/hr-central/performance/types/development.types';

const PERFORMANCE_COLOR = '#FF5722';

// Training type icons
const TYPE_ICONS: Record<TrainingType, any> = {
  external_course: ExternalLink,
  e_learning: Video,
  mentorship: User,
  workshop: Users,
  internal_course: BookOpen,
  certification: Award,
  on_the_job: Briefcase,
};

const TYPE_COLORS: Record<TrainingType, string> = {
  external_course: 'text-blue-600 bg-blue-50 border-blue-200',
  e_learning: 'text-indigo-600 bg-indigo-50 border-indigo-200',
  mentorship: 'text-pink-600 bg-pink-50 border-pink-200',
  workshop: 'text-orange-600 bg-orange-50 border-orange-200',
  internal_course: 'text-green-600 bg-green-50 border-green-200',
  certification: 'text-purple-600 bg-purple-50 border-purple-200',
  on_the_job: 'text-teal-600 bg-teal-50 border-teal-200',
};

const TYPE_LABELS: Record<TrainingType, string> = {
  external_course: 'External Course',
  e_learning: 'Video/E-Learning',
  mentorship: '1-on-1 Mentorship',
  workshop: 'Workshop',
  internal_course: 'Internal Course',
  certification: 'Certification',
  on_the_job: 'On-the-Job Training',
};

export function TrainingCourseDetailPage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const { state } = useGlobalState();

  const {
    trainingCourses,
    employeeTraining,
    competencies,
    isLoading,
    error,
    enrollInTraining,
    deleteTrainingCourse,
  } = useDevelopment({
    companyId: state.currentOrganizationId || '',
    employeeId: state.auth.user?.userId,
    autoLoad: true,
  });

  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const course = trainingCourses.find(c => c.id === courseId);
  const enrollment = employeeTraining.find(
    e => e.courseId === courseId && e.employeeId === state.auth.user?.userId
  );

  const handleEnroll = async () => {
    if (!courseId || !state.auth.user?.userId) return;

    setIsEnrolling(true);
    try {
      await enrollInTraining(courseId);
    } catch (err) {
      console.error('Failed to enroll:', err);
      alert('Failed to enroll in course');
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleDelete = async () => {
    if (!courseId) return;

    if (!confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteTrainingCourse(courseId);
      navigate('/hr/performance/training');
    } catch (err) {
      console.error('Failed to delete course:', err);
      alert('Failed to delete course');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading && trainingCourses.length === 0) {
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

  if (!course) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-lg font-semibold mb-2">Course Not Found</h3>
        <p className="text-muted-foreground mb-4">
          The training course you're looking for doesn't exist.
        </p>
        <Button onClick={() => navigate('/hr/performance/training')}>
          Back to Training Catalog
        </Button>
      </Card>
    );
  }

  const TypeIcon = TYPE_ICONS[(course.trainingType || 'external_course') as TrainingType];
  const targetCompetenciesData = competencies.filter(c =>
    course.targetCompetencies.includes(c.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/hr/performance/training')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{course.title}</h1>
            <p className="text-muted-foreground">Training Course Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!enrollment && (
            <Button
              onClick={handleEnroll}
              disabled={isEnrolling}
              style={{ backgroundColor: PERFORMANCE_COLOR }}
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              {isEnrolling ? 'Enrolling...' : 'Enroll Now'}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => navigate(`/hr/performance/training/${courseId}/edit`)}
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

      {/* Enrollment Status */}
      {enrollment && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-blue-900">You're enrolled in this course</p>
                <p className="text-sm text-blue-700">
                  Enrolled on {(enrollment.enrolledDate instanceof Date ? enrollment.enrolledDate : (enrollment.enrolledDate as any).toDate?.())?.toLocaleDateString() || 'N/A'}
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  enrollment.status === 'completed'
                    ? 'bg-green-100 text-green-800 border-green-300'
                    : enrollment.status === 'in_progress'
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'bg-gray-100 text-gray-800 border-gray-300'
                }
              >
                {enrollment.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                {enrollment.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-blue-700">Progress</span>
                <span className="font-medium text-blue-900">{enrollment.progress}%</span>
              </div>
              <Progress value={enrollment.progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Course Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Badge className={`${TYPE_COLORS[(course.trainingType ?? 'external_course') as TrainingType]} border`}>
                  <TypeIcon className="h-3 w-3 mr-1" />
                  {TYPE_LABELS[(course.trainingType ?? 'external_course') as TrainingType]}
                </Badge>
              </div>

              <p className="text-muted-foreground">{course.description}</p>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{course.duration} hours</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Provider:</span>
                  <span className="text-muted-foreground">{course.provider.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Delivery:</span>
                  <span className="text-muted-foreground">{course.deliveryMethod}</span>
                </div>
                {course.cost && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>${course.cost}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Type-Specific Details */}
          {course.trainingType === 'external_course' && course.externalUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5 text-blue-600" />
                  External Platform
                </CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={course.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-2"
                >
                  {course.externalUrl}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </CardContent>
            </Card>
          )}

          {course.trainingType === 'e_learning' && course.videoUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-indigo-600" />
                  Video Content
                </CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={course.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-2"
                >
                  Access Video
                  <ExternalLink className="h-4 w-4" />
                </a>
              </CardContent>
            </Card>
          )}

          {course.trainingType === 'workshop' && course.workshopDetails && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-orange-600" />
                  Workshop Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {course.workshopDetails.date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{String(course.workshopDetails.date)}</span>
                  </div>
                )}
                {course.workshopDetails.time && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{course.workshopDetails.time}</span>
                  </div>
                )}
                {course.workshopDetails.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{course.workshopDetails.location}</span>
                  </div>
                )}
                {course.workshopDetails.trainerName && (
                  <div className="pt-3 border-t">
                    <p className="text-sm font-medium">External Trainer</p>
                    <p className="text-sm text-muted-foreground">{course.workshopDetails.trainerName}</p>
                    {course.workshopDetails.trainerContact && (
                      <p className="text-xs text-muted-foreground">{course.workshopDetails.trainerContact}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {course.trainingType === 'mentorship' && course.mentorId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-pink-600" />
                  Mentorship
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Mentor ID: {course.mentorId}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Learning Objectives */}
          <Card>
            <CardHeader>
              <CardTitle>Learning Objectives</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {course.learningObjectives.map((objective, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{objective}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Target Competencies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Target Competencies
              </CardTitle>
            </CardHeader>
            <CardContent>
              {targetCompetenciesData.length === 0 ? (
                <p className="text-sm text-muted-foreground">No competencies mapped</p>
              ) : (
                <div className="space-y-2">
                  {targetCompetenciesData.map(comp => (
                    <div
                      key={comp.id}
                      className="p-2 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/hr/performance/competencies/${comp.id}`)}
                    >
                      <p className="text-sm font-medium">{comp.name}</p>
                      <Badge variant="outline" className="text-xs mt-1">
                        {comp.category}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Course Info */}
          <Card>
            <CardHeader>
              <CardTitle>Course Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {course.maxParticipants && (
                <div>
                  <p className="font-medium">Max Participants</p>
                  <p className="text-muted-foreground">{course.maxParticipants}</p>
                </div>
              )}
              {course.certificateOffered && (
                <div className="flex items-center gap-2 text-green-600">
                  <Award className="h-4 w-4" />
                  <span>Certificate offered upon completion</span>
                </div>
              )}
              <div>
                <p className="font-medium">Status</p>
                <Badge variant="outline" className={course.isActive ? 'text-green-600' : 'text-gray-600'}>
                  {course.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default TrainingCourseDetailPage;
