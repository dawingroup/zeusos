/**
 * EmployeeDetailPage.tsx
 * Comprehensive employee detail view with tabs for different data sections
 * ZeusOS v2.0 - HR Central
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Briefcase,
  Calendar,
  DollarSign,
  Award,
  Phone,
  Mail,
  MapPin,
  Building2,
  Clock,
  FileText,
  Edit,
  MoreVertical,
  UserCheck,
  AlertCircle,
  Loader2,
  Shield,
  UserPlus,
  ExternalLink,
} from 'lucide-react';

import { Button } from '@/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/core/components/ui/alert';
import { Skeleton } from '@/core/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';

import { useEmployee } from '@/modules/hr-central/hooks/useEmployee';
import { RoleAssignmentSection } from '@/modules/hr-central/components/employees';
import { SubsidiaryAllocationsCard } from '@/modules/hr-central/components/employees/SubsidiaryAllocationsCard';
import { employeeService } from '@/modules/hr-central/services/employee.service';
import { useAuth } from '@/integration/store';
import { useCurrentDawinUser, createUser, getUserByUid } from '@/core/settings';
import {
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from '@/modules/hr-central/config/employee.constants';

const HR_COLOR = '#2196F3';

// Helper function to safely convert dates
function toDate(value: any): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'string') return new Date(value);
  if (value.seconds !== undefined) return new Date(value.seconds * 1000);
  return new Date();
}

// Format date helper
function formatDate(value: any): string {
  if (!value) return '-';
  const date = toDate(value);
  return date.toLocaleDateString('en-UG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Calculate tenure
function calculateTenure(joiningDate: any): string {
  const start = toDate(joiningDate);
  const now = new Date();
  const years = Math.floor((now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  const months = Math.floor(((now.getTime() - start.getTime()) % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
  
  if (years > 0) {
    return `${years} year${years > 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''}`;
  }
  return `${months} month${months !== 1 ? 's' : ''}`;
}

// Status colors
const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  probation: 'bg-yellow-100 text-yellow-800',
  suspended: 'bg-red-100 text-red-800',
  notice_period: 'bg-orange-100 text-orange-800',
  on_leave: 'bg-blue-100 text-blue-800',
  terminated: 'bg-gray-100 text-gray-800',
  resigned: 'bg-gray-100 text-gray-800',
  retired: 'bg-purple-100 text-purple-800',
};

// Info row component
function InfoRow({ label, value, icon: Icon }: { label: string; value: string | React.ReactNode; icon?: any }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />}
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value || '-'}</p>
      </div>
    </div>
  );
}

// Section component
function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function EmployeeDetailPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const { email: authEmail, userId: authUserId } = useAuth();
  const { dawinUser: currentDawinUser } = useCurrentDawinUser();
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserResult, setCreateUserResult] = useState<{ success?: string; error?: string } | null>(null);
  const [hasDawinUser, setHasDawinUser] = useState<boolean | null>(null); // null = loading

  const { employee, loading, error } = useEmployee(employeeId || null);

  // Check if employee actually has a DawinUser doc (not just a Firebase Auth UID)
  useEffect(() => {
    const uid = employee?.systemAccess?.userId;
    if (!uid) {
      setHasDawinUser(false);
      return;
    }
    setHasDawinUser(null); // loading
    getUserByUid('default', uid)
      .then((dawinDoc) => setHasDawinUser(!!dawinDoc))
      .catch(() => setHasDawinUser(false));
  }, [employee?.systemAccess?.userId]);

  const isAdmin = currentDawinUser
    ? ['admin', 'owner'].includes(currentDawinUser.globalRole)
    : false;
  const SUPER_USER_EMAILS = ['onzimai@zeusgroup.co.ug'];
  const isSuperUser = authEmail ? SUPER_USER_EMAILS.includes(authEmail) : false;
  const canCreateUser = isAdmin || isSuperUser;

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error?.message || 'Employee not found'}
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/hr/employees')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Employees
        </Button>
      </div>
    );
  }

  const fullName = `${employee.firstName} ${employee.middleName || ''} ${employee.lastName}`.trim();
  const primaryPhone = employee.phoneNumbers?.find(p => p.isPrimary)?.number || employee.phoneNumbers?.[0]?.number;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/hr/employees')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          {/* Avatar */}
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {employee.photoUrl ? (
              <img src={employee.photoUrl} alt={fullName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-semibold text-muted-foreground">
                {employee.firstName[0]}{employee.lastName[0]}
              </span>
            )}
          </div>
          
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{fullName}</h1>
              <Badge className={cn('capitalize', statusColors[employee.employmentStatus])}>
                {EMPLOYMENT_STATUS_LABELS[employee.employmentStatus] || employee.employmentStatus}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {employee.position?.title} • {employee.position?.departmentId}
            </p>
            <p className="text-sm text-muted-foreground">
              Employee #{employee.employeeNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/hr/employees/${employeeId}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/hr/leave?employee=${employeeId}`)}>
                <Calendar className="h-4 w-4 mr-2" />
                View Leave History
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/hr/payroll?employee=${employeeId}`)}>
                <DollarSign className="h-4 w-4 mr-2" />
                View Payroll
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                Deactivate Employee
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tenure</p>
                <p className="font-semibold">{calculateTenure(employee.employmentDates?.joiningDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Leave Balance</p>
                <p className="font-semibold">{employee.leaveBalance?.annual || 0} days</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <UserCheck className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Direct Reports</p>
                <p className="font-semibold">{employee.position?.directReports || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <Briefcase className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Employment Type</p>
                <p className="font-semibold capitalize">
                  {EMPLOYMENT_TYPE_LABELS[employee.employmentType] || employee.employmentType}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="employment" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Employment
          </TabsTrigger>
          <TabsTrigger value="leave" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Leave
          </TabsTrigger>
          <TabsTrigger value="payroll" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Payroll
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            System Access
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Section title="Basic Details">
                  <InfoRow label="Full Name" value={fullName} icon={User} />
                  <InfoRow label="Date of Birth" value={formatDate(employee.dateOfBirth)} icon={Calendar} />
                  <InfoRow label="Gender" value={employee.gender} />
                  <InfoRow label="Nationality" value={employee.nationality} />
                  <InfoRow label="Marital Status" value={employee.maritalStatus} />
                </Section>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Section title="Contact Details">
                  <InfoRow label="Work Email" value={employee.email} icon={Mail} />
                  <InfoRow label="Personal Email" value={employee.personalEmail} icon={Mail} />
                  <InfoRow label="Phone" value={primaryPhone} icon={Phone} />
                  <InfoRow 
                    label="Location" 
                    value={employee.position?.location || employee.addresses?.[0]?.city} 
                    icon={MapPin} 
                  />
                </Section>
                
                {employee.emergencyContacts && employee.emergencyContacts.length > 0 && (
                  <Section title="Emergency Contact">
                    <InfoRow 
                      label={employee.emergencyContacts[0].relationship} 
                      value={employee.emergencyContacts[0].name} 
                    />
                    <InfoRow 
                      label="Phone" 
                      value={employee.emergencyContacts[0].phoneNumbers?.[0]?.number} 
                      icon={Phone}
                    />
                  </Section>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Employment Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Employment Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <InfoRow label="Employee Number" value={employee.employeeNumber} icon={FileText} />
                <InfoRow label="Position" value={employee.position?.title} icon={Briefcase} />
                <InfoRow 
                  label="Department" 
                  value={employee.position?.departmentId} 
                  icon={Building2} 
                />
                <InfoRow label="Joining Date" value={formatDate(employee.employmentDates?.joiningDate)} icon={Calendar} />
              </div>
            </CardContent>
          </Card>

          <SubsidiaryAllocationsCard
            employee={employee}
            onSaved={() => window.location.reload()}
          />
        </TabsContent>

        {/* Employment Tab */}
        <TabsContent value="employment" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Position Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow label="Job Title" value={employee.position?.title} />
                <InfoRow label="Job Code" value={employee.position?.jobCode} />
                <InfoRow label="Grade Level" value={employee.position?.gradeLevel} />
                <InfoRow 
                  label="Department" 
                  value={employee.position?.departmentId} 
                />
                <InfoRow label="Location" value={employee.position?.location} />
                <InfoRow label="Management Role" value={employee.position?.isManagement ? 'Yes' : 'No'} />
                <InfoRow label="Direct Reports" value={String(employee.position?.directReports || 0)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Employment Dates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow label="Joining Date" value={formatDate(employee.employmentDates?.joiningDate)} />
                <InfoRow label="Probation Start" value={formatDate(employee.employmentDates?.probationStartDate)} />
                <InfoRow label="Probation End" value={formatDate(employee.employmentDates?.probationEndDate)} />
                <InfoRow label="Confirmation Date" value={formatDate(employee.employmentDates?.confirmationDate)} />
                <InfoRow label="Last Promotion" value={formatDate(employee.employmentDates?.lastPromotionDate)} />
                <InfoRow label="Employment Type" value={EMPLOYMENT_TYPE_LABELS[employee.employmentType]} />
                <InfoRow label="Employment Status" value={EMPLOYMENT_STATUS_LABELS[employee.employmentStatus]} />
              </CardContent>
            </Card>
          </div>

          {/* Work Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Work Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <InfoRow label="Schedule Type" value={employee.workSchedule?.type?.replace('_', ' ')} />
                <InfoRow label="Working Hours" value={`${employee.workSchedule?.startTime || '08:00'} - ${employee.workSchedule?.endTime || '17:00'}`} />
                <InfoRow label="Weekly Hours" value={`${employee.workSchedule?.weeklyHours || 40} hours`} />
                <InfoRow label="Remote Eligible" value={employee.workSchedule?.isRemoteEligible ? 'Yes' : 'No'} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave Tab */}
        <TabsContent value="leave" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Leave Balance</CardTitle>
                <CardDescription>Current leave entitlements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span>Annual Leave</span>
                  <span className="font-bold text-lg">{employee.leaveBalance?.annual || 0} days</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span>Sick Leave</span>
                  <span className="font-bold text-lg">{employee.leaveBalance?.sick || 0} days</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span>Compassionate</span>
                  <span className="font-bold text-lg">{employee.leaveBalance?.compassionate || 0} days</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span>Carried Over</span>
                  <span className="font-bold text-lg">{employee.leaveBalance?.carriedOver || 0} days</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Annual Entitlements</CardTitle>
                <CardDescription>Per year allocation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow label="Annual Leave" value={`${employee.leaveEntitlements?.annualLeave || 21} days/year`} />
                <InfoRow label="Sick Leave" value={`${employee.leaveEntitlements?.sickLeave || 30} days/year`} />
                <InfoRow label="Maternity Leave" value={`${employee.leaveEntitlements?.maternityLeave || 60} days`} />
                <InfoRow label="Paternity Leave" value={`${employee.leaveEntitlements?.paternityLeave || 4} days`} />
                <InfoRow label="Study Leave" value={`${employee.leaveEntitlements?.studyLeave || 0} days/year`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full" 
                  style={{ backgroundColor: HR_COLOR }}
                  onClick={() => navigate(`/hr/leave?employee=${employeeId}&action=request`)}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Request Leave
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate(`/hr/leave?employee=${employeeId}`)}
                >
                  View Leave History
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payroll Tab */}
        <TabsContent value="payroll" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Statutory Details</CardTitle>
                <CardDescription>Uganda statutory requirements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Section title="NSSF Details">
                  <InfoRow label="NSSF Number" value={employee.nssf?.memberNumber} />
                  <InfoRow label="Employee Contribution" value={`${employee.nssf?.employeeContribution || 5}%`} />
                  <InfoRow label="Employer Contribution" value={`${employee.nssf?.employerContribution || 10}%`} />
                  <InfoRow label="Status" value={employee.nssf?.isActive ? 'Active' : 'Inactive'} />
                </Section>
                
                <Section title="Tax Details">
                  <InfoRow label="TIN Number" value={employee.tax?.tinNumber} />
                  <InfoRow label="Tax Exempt" value={employee.tax?.taxExempt ? 'Yes' : 'No'} />
                </Section>

                <Section title="Local Service Tax">
                  <InfoRow label="Applicable" value={employee.localServiceTax?.isApplicable ? 'Yes' : 'No'} />
                  <InfoRow label="District" value={employee.localServiceTax?.district} />
                  <InfoRow label="Annual Amount" value={`UGX ${(employee.localServiceTax?.annualAmount || 0).toLocaleString()}`} />
                </Section>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment Information</CardTitle>
                <CardDescription>Salary payment details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Section title="Preferred Payment">
                  <InfoRow 
                    label="Payment Method" 
                    value={employee.preferredPaymentMethod?.replace('_', ' ')} 
                  />
                </Section>

                {employee.bankAccounts && employee.bankAccounts.length > 0 && (
                  <Section title="Bank Account">
                    <InfoRow label="Bank" value={employee.bankAccounts[0].bankName} />
                    <InfoRow label="Account Name" value={employee.bankAccounts[0].accountName} />
                    <InfoRow label="Account Number" value={`****${employee.bankAccounts[0].accountNumber?.slice(-4)}`} />
                    <InfoRow label="Branch" value={employee.bankAccounts[0].branchName} />
                  </Section>
                )}

                {employee.mobileMoneyAccounts && employee.mobileMoneyAccounts.length > 0 && (
                  <Section title="Mobile Money">
                    <InfoRow label="Provider" value={employee.mobileMoneyAccounts[0].provider?.toUpperCase()} />
                    <InfoRow label="Phone" value={employee.mobileMoneyAccounts[0].phoneNumber} />
                    <InfoRow label="Account Name" value={employee.mobileMoneyAccounts[0].accountName} />
                  </Section>
                )}

                <div className="pt-4">
                  <Button 
                    className="w-full" 
                    style={{ backgroundColor: HR_COLOR }}
                    onClick={() => navigate(`/hr/payroll?employee=${employeeId}`)}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    View Payslips
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Skills & Competencies</CardTitle>
              </CardHeader>
              <CardContent>
                {employee.skills && employee.skills.length > 0 ? (
                  <div className="space-y-3">
                    {employee.skills.map((skill: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">{skill.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{skill.category}</p>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {skill.proficiencyLevel}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No skills recorded</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Certifications</CardTitle>
              </CardHeader>
              <CardContent>
                {employee.certifications && employee.certifications.length > 0 ? (
                  <div className="space-y-3">
                    {employee.certifications.map((cert: any, index: number) => (
                      <div key={index} className="p-3 bg-muted rounded-lg">
                        <p className="font-medium">{cert.name}</p>
                        <p className="text-sm text-muted-foreground">{cert.issuingBody}</p>
                        <p className="text-xs text-muted-foreground">
                          Issued: {formatDate(cert.issueDate)}
                          {cert.expiryDate && ` • Expires: ${formatDate(cert.expiryDate)}`}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No certifications recorded</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Education & Experience</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Education</h4>
                  {employee.education && employee.education.length > 0 ? (
                    <div className="space-y-3">
                      {employee.education.map((edu: any, index: number) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <p className="font-medium">{edu.qualification}</p>
                          <p className="text-sm">{edu.institution}</p>
                          <p className="text-xs text-muted-foreground">{edu.fieldOfStudy}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No education records</p>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Work Experience</h4>
                  {employee.workExperience && employee.workExperience.length > 0 ? (
                    <div className="space-y-3">
                      {employee.workExperience.map((exp: any, index: number) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <p className="font-medium">{exp.position}</p>
                          <p className="text-sm">{exp.company}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(exp.startDate)} - {exp.isCurrent ? 'Present' : formatDate(exp.endDate)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No experience records</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Access Tab */}
        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Role Assignment</CardTitle>
              <CardDescription>
                Assign role profiles to enable automatic task routing via the Intelligence Layer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RoleAssignmentSection
                employee={employee}
                onUpdate={async (empId, accessRoles) => {
                  await employeeService.updateEmployeeRoles(
                    empId,
                    accessRoles,
                    authUserId || 'system'
                  );
                }}
                isEditable={true}
              />
            </CardContent>
          </Card>

          {/* User Account Management - Admin Only */}
          {canCreateUser && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-lg">Platform User Account</CardTitle>
                    <CardDescription>
                      Create or manage this employee's system login and module access
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {createUserResult?.success && (
                  <Alert className="mb-4 border-green-200 bg-green-50">
                    <AlertDescription className="text-green-700">
                      {createUserResult.success}
                    </AlertDescription>
                  </Alert>
                )}
                {createUserResult?.error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{createUserResult.error}</AlertDescription>
                  </Alert>
                )}

                {hasDawinUser === null ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Checking user account...</span>
                  </div>
                ) : hasDawinUser ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                        User Account Active
                      </Badge>
                      {employee.systemAccess?.userId && (
                        <span className="text-xs text-muted-foreground">
                          UID: {employee.systemAccess.userId}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigate('/admin/users');
                      }}
                    >
                      <ExternalLink className="mr-2 h-3 w-3" />
                      View in User Management
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {employee.systemAccess?.userId
                        ? 'This employee has a login but no platform user profile. Create one to manage their access.'
                        : 'This employee does not have a platform user account. Create one to grant them login access and module permissions.'}
                    </p>
                    <Button
                      onClick={async () => {
                        if (!employee) return;
                        setCreatingUser(true);
                        setCreateUserResult(null);
                        try {
                          const fullName = [employee.firstName, employee.middleName, employee.lastName]
                            .filter(Boolean)
                            .join(' ');
                          const userData: Record<string, any> = {
                            uid: employee.systemAccess?.userId || '',
                            email: employee.email,
                            displayName: fullName,
                            jobTitle: employee.position.title,
                            department: employee.position.departmentId,
                            globalRole: 'member',
                            isActive: true,
                            subsidiaryAccess: [],
                          };
                          if (employee.photoUrl) userData.photoUrl = employee.photoUrl;
                          const primaryPhone = employee.phoneNumbers?.find(p => p.isPrimary)?.number;
                          if (primaryPhone) userData.phone = primaryPhone;
                          const newUserId = await createUser('default', userData as any);
                          setCreateUserResult({
                            success: `User account created successfully. You can now configure access.`,
                          });
                          // Navigate to the new user's detail page after a short delay
                          setTimeout(() => {
                            navigate(`/admin/users/${newUserId}`);
                          }, 1500);
                        } catch (err: any) {
                          console.error('Failed to create user account:', err);
                          setCreateUserResult({
                            error: err?.message || 'Failed to create user account. Please try again.',
                          });
                        } finally {
                          setCreatingUser(false);
                        }
                      }}
                      disabled={creatingUser}
                    >
                      {creatingUser ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Account...
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Create User Account
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default EmployeeDetailPage;
