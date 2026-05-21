/**
 * Employee Detail Component - ZeusOS v2.0
 * Full employee profile view with header and tabbed interface
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Avatar,
  Typography,
  Chip,
  Button,
  Tabs,
  Tab,
  Grid,
  Skeleton,
  Alert,
  Paper,
} from '@mui/material';
import {
  Edit as EditIcon,
  SwapHoriz as TransferIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  AccountBalance as BankIcon,
  School as SchoolIcon,
  People as FamilyIcon,
  Description as DocumentIcon,
  History as HistoryIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { format, differenceInYears, differenceInMonths } from 'date-fns';

import {
  EmploymentStatus,
} from '../../types/employee.types';
import {
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from '../../config/employee.constants';
import { useEmployee } from '../../hooks/useEmployee';
import { useRecordTracker } from '@/core/hooks/useRecordTracker';
import { StatusChangeDialog, StatusChangeEmployee } from './StatusChangeDialog';

const STATUS_COLORS: Record<EmploymentStatus, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  active: 'success',
  probation: 'info',
  suspended: 'error',
  notice_period: 'warning',
  on_leave: 'info',
  terminated: 'error',
  resigned: 'default',
  retired: 'default',
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ py: 3 }}>
    {value === index && children}
  </Box>
);

// Simple info row component
const InfoRow: React.FC<{ label: string; value?: string | React.ReactNode }> = ({ label, value }) => (
  <Box sx={{ py: 1 }}>
    <Typography variant="caption" color="text.secondary" display="block">
      {label}
    </Typography>
    <Typography variant="body2">
      {value || '-'}
    </Typography>
  </Box>
);

export const EmployeeDetail: React.FC = () => {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();

  const { employee, loading, error } = useEmployee(employeeId || null);
  // Log this record for the Global Search palette's recency boost + empty state.
  useRecordTracker({
    type: 'employee',
    id: employee?.id,
    title: employee ? `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() : '',
    subtitle: (employee as { jobTitle?: string } | null | undefined)?.jobTitle,
    module: 'hr_central',
  });
  const [activeTab, setActiveTab] = useState(0);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  // Calculate tenure
  const getTenure = (joiningDate: Date): string => {
    const years = differenceInYears(new Date(), joiningDate);
    const months = differenceInMonths(new Date(), joiningDate) % 12;
    
    if (years > 0) {
      return `${years} year${years !== 1 ? 's' : ''}, ${months} month${months !== 1 ? 's' : ''}`;
    }
    return `${months} month${months !== 1 ? 's' : ''}`;
  };

  // Loading state
  if (loading) {
    return (
      <Box>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Skeleton variant="circular" width={120} height={120} />
              <Box sx={{ flexGrow: 1 }}>
                <Skeleton variant="text" width={300} height={40} />
                <Skeleton variant="text" width={200} />
                <Skeleton variant="text" width={150} />
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Skeleton variant="rounded" height={48} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={300} />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert severity="error">
        Error loading employee: {error.message}
      </Alert>
    );
  }

  // Not found state
  if (!employee) {
    return (
      <Alert severity="warning">
        Employee not found
      </Alert>
    );
  }

  const tabs = [
    { label: 'Personal', icon: <PersonIcon /> },
    { label: 'Employment', icon: <WorkIcon /> },
    { label: 'Financial', icon: <BankIcon /> },
    { label: 'Qualifications', icon: <SchoolIcon /> },
    { label: 'Family', icon: <FamilyIcon /> },
    { label: 'Documents', icon: <DocumentIcon /> },
    { label: 'History', icon: <HistoryIcon /> },
  ];

  const statusChangeEmployee: StatusChangeEmployee = {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    fullName: `${employee.firstName} ${employee.lastName}`,
    employmentStatus: employee.employmentStatus,
  };

  return (
    <Box>
      {/* Header card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 3,
              alignItems: { xs: 'center', md: 'flex-start' },
            }}
          >
            {/* Avatar */}
            <Avatar
              src={employee.photoUrl || undefined}
              alt={`${employee.firstName} ${employee.lastName}`}
              sx={{ width: 120, height: 120, fontSize: 48 }}
            >
              {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
            </Avatar>

            {/* Main info */}
            <Box sx={{ flexGrow: 1, textAlign: { xs: 'center', md: 'left' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: { xs: 'center', md: 'flex-start' }, mb: 1 }}>
                <Typography variant="h4">
                  {employee.firstName} {employee.middleName ? `${employee.middleName} ` : ''}{employee.lastName}
                </Typography>
                <Chip
                  label={EMPLOYMENT_STATUS_LABELS[employee.employmentStatus]}
                  color={STATUS_COLORS[employee.employmentStatus]}
                />
              </Box>

              <Typography variant="h6" color="text.secondary" gutterBottom>
                {employee.position.title}
              </Typography>

              <Typography variant="body1" fontFamily="monospace" color="text.secondary" gutterBottom>
                {employee.employeeNumber}
              </Typography>

              {/* Contact info */}
              <Box sx={{ display: 'flex', gap: 3, mt: 2, flexWrap: 'wrap', justifyContent: { xs: 'center', md: 'flex-start' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EmailIcon fontSize="small" color="action" />
                  <Typography variant="body2">{employee.email}</Typography>
                </Box>
                {employee.phoneNumbers[0] && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PhoneIcon fontSize="small" color="action" />
                    <Typography variant="body2">{employee.phoneNumbers[0].number}</Typography>
                  </Box>
                )}
                {employee.position.location && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationIcon fontSize="small" color="action" />
                    <Typography variant="body2">{employee.position.location}</Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Quick stats */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 2,
                minWidth: 280,
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary">Department</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {employee.position.departmentId}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Joined</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {format(employee.employmentDates.joiningDate.toDate(), 'dd MMM yyyy')}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Employment Type</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {EMPLOYMENT_TYPE_LABELS[employee.employmentType]}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Direct Reports</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {employee.position.directReports || 0}
                </Typography>
              </Box>
              <Box sx={{ gridColumn: 'span 2' }}>
                <Typography variant="caption" color="text.secondary">Tenure</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {getTenure(employee.employmentDates.joiningDate.toDate())}
                </Typography>
              </Box>
            </Box>

            {/* Actions */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => navigate(`/hr/employees/${employee.id}/edit`)}
              >
                Edit Profile
              </Button>
              <Button
                variant="outlined"
                startIcon={<TransferIcon />}
                onClick={() => setStatusDialogOpen(true)}
              >
                Change Status
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_: React.SyntheticEvent, newValue: number) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Paper>

      {/* Tab content */}
      <TabPanel value={activeTab} index={0}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Personal Information</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} {...({} as any)}>
              <InfoRow label="Full Name" value={`${employee.firstName} ${employee.middleName || ''} ${employee.lastName}`} />
              <InfoRow label="Preferred Name" value={employee.preferredName} />
              <InfoRow label="Date of Birth" value={format(employee.dateOfBirth.toDate(), 'dd MMM yyyy')} />
              <InfoRow label="Gender" value={employee.gender} />
            </Grid>
            <Grid item xs={12} md={6} {...({} as any)}>
              <InfoRow label="Marital Status" value={employee.maritalStatus} />
              <InfoRow label="Nationality" value={employee.nationality} />
              <InfoRow label="Religion" value={employee.religion} />
            </Grid>
          </Grid>
        </Paper>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Employment Details</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} {...({} as any)}>
              <InfoRow label="Position" value={employee.position.title} />
              <InfoRow label="Department" value={employee.position.departmentId} />
              <InfoRow label="Reports To" value={employee.position.reportingTo || 'N/A'} />
              <InfoRow label="Location" value={employee.position.location} />
            </Grid>
            <Grid item xs={12} md={6} {...({} as any)}>
              <InfoRow label="Employment Type" value={EMPLOYMENT_TYPE_LABELS[employee.employmentType]} />
              <InfoRow label="Joining Date" value={format(employee.employmentDates.joiningDate.toDate(), 'dd MMM yyyy')} />
              {employee.employmentDates.probationEndDate && (
                <InfoRow label="Probation End" value={format(employee.employmentDates.probationEndDate.toDate(), 'dd MMM yyyy')} />
              )}
              {employee.employmentDates.confirmationDate && (
                <InfoRow label="Confirmed On" value={format(employee.employmentDates.confirmationDate.toDate(), 'dd MMM yyyy')} />
              )}
            </Grid>
          </Grid>
        </Paper>
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Financial Information</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} {...({} as any)}>
              <Typography variant="subtitle2" gutterBottom>Bank Accounts</Typography>
              {employee.bankAccounts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No bank accounts on file</Typography>
              ) : (
                employee.bankAccounts.map((account, idx) => (
                  <Box key={idx} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="body2" fontWeight={500}>{account.bankName}</Typography>
                    <Typography variant="body2">{account.accountNumber}</Typography>
                    {account.isPrimary && <Chip label="Primary" size="small" sx={{ mt: 1 }} />}
                  </Box>
                ))
              )}
            </Grid>
            <Grid item xs={12} md={6} {...({} as any)}>
              <Typography variant="subtitle2" gutterBottom>Mobile Money</Typography>
              {employee.mobileMoneyAccounts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No mobile money accounts on file</Typography>
              ) : (
                employee.mobileMoneyAccounts.map((account, idx) => (
                  <Box key={idx} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="body2" fontWeight={500}>{account.provider}</Typography>
                    <Typography variant="body2">{account.phoneNumber}</Typography>
                    {account.isPrimary && <Chip label="Primary" size="small" sx={{ mt: 1 }} />}
                  </Box>
                ))
              )}
            </Grid>
          </Grid>
          
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>Statutory Information</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4} {...({} as any)}>
              <InfoRow label="NSSF Number" value={employee.nssf?.memberNumber} />
            </Grid>
            <Grid item xs={12} md={4} {...({} as any)}>
              <InfoRow label="TIN" value={employee.tax?.tinNumber} />
            </Grid>
            <Grid item xs={12} md={4} {...({} as any)}>
              <InfoRow label="LST District" value={employee.localServiceTax?.district} />
            </Grid>
          </Grid>
        </Paper>
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Qualifications</Typography>
          
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>Education</Typography>
          {employee.education.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No education records</Typography>
          ) : (
            employee.education.map((edu, idx) => (
              <Box key={idx} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" fontWeight={500}>{edu.qualification} in {edu.fieldOfStudy}</Typography>
                <Typography variant="body2">{edu.institution}</Typography>
                <Typography variant="caption" color="text.secondary">{format(edu.startDate.toDate(), 'yyyy')} - {edu.endDate ? format(edu.endDate.toDate(), 'yyyy') : 'Present'}</Typography>
              </Box>
            ))
          )}

          <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>Certifications</Typography>
          {employee.certifications.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No certifications</Typography>
          ) : (
            employee.certifications.map((cert, idx) => (
              <Box key={idx} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" fontWeight={500}>{cert.name}</Typography>
                <Typography variant="body2">{cert.issuingBody}</Typography>
              </Box>
            ))
          )}

          <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>Skills</Typography>
          {employee.skills.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No skills recorded</Typography>
          ) : (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {employee.skills.map((skill, idx) => (
                <Chip key={idx} label={`${skill.name} (${skill.proficiencyLevel})`} variant="outlined" />
              ))}
            </Box>
          )}
        </Paper>
      </TabPanel>

      <TabPanel value={activeTab} index={4}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Family & Dependents</Typography>
          
          <Typography variant="subtitle2" gutterBottom>Emergency Contacts</Typography>
          {employee.emergencyContacts.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No emergency contacts</Typography>
          ) : (
            employee.emergencyContacts.map((contact, idx) => (
              <Box key={idx} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" fontWeight={500}>{contact.name}</Typography>
                <Typography variant="body2">{contact.relationship}</Typography>
                <Typography variant="body2">{contact.phoneNumbers[0]?.number || 'N/A'}</Typography>
              </Box>
            ))
          )}

          <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>Dependents</Typography>
          {employee.dependents.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No dependents recorded</Typography>
          ) : (
            employee.dependents.map((dep, idx) => (
              <Box key={idx} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" fontWeight={500}>{dep.name}</Typography>
                <Typography variant="body2">{dep.relationship}</Typography>
              </Box>
            ))
          )}
        </Paper>
      </TabPanel>

      <TabPanel value={activeTab} index={5}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Documents</Typography>
          {employee.documents.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No documents uploaded</Typography>
          ) : (
            employee.documents.map((doc, idx) => (
              <Box key={idx} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" fontWeight={500}>{doc.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{doc.type}</Typography>
                </Box>
                <Button size="small" variant="outlined">View</Button>
              </Box>
            ))
          )}
        </Paper>
      </TabPanel>

      <TabPanel value={activeTab} index={6}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Employment History</Typography>
          
          <Typography variant="subtitle2" gutterBottom>Previous Experience</Typography>
          {employee.workExperience.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No previous work experience recorded</Typography>
          ) : (
            employee.workExperience.map((exp, idx) => (
              <Box key={idx} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" fontWeight={500}>{exp.position}</Typography>
                <Typography variant="body2">{exp.company}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {exp.startDate as any} - {(exp.endDate as any) || 'Present'}
                </Typography>
              </Box>
            ))
          )}
          
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>Audit Trail</Typography>
          <Typography variant="body2" color="text.secondary">
            Created: {format(employee.createdAt.toDate(), 'dd MMM yyyy HH:mm')} by {employee.createdBy}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last Updated: {format(employee.updatedAt.toDate(), 'dd MMM yyyy HH:mm')} by {employee.updatedBy}
          </Typography>
        </Paper>
      </TabPanel>

      {/* Status change dialog */}
      <StatusChangeDialog
        open={statusDialogOpen}
        employee={statusChangeEmployee}
        onClose={() => setStatusDialogOpen(false)}
        onSuccess={() => setStatusDialogOpen(false)}
      />
    </Box>
  );
};

export default EmployeeDetail;
