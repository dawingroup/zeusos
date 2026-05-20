/**
 * Employee Form Component - DawinOS v2.0
 * Multi-step form for creating or editing employees
 * Enhanced UI with contracts/documents section
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Upload, 
  Loader2, 
  Check, 
  User, 
  Phone, 
  Briefcase, 
  FileText,
  CheckCircle,
  X,
  Plus,
  Trash2,
  Calendar,
  Building2,
  Mail,
  MapPin,
  DollarSign,
} from 'lucide-react';

import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import { Textarea } from '@/core/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { Alert, AlertDescription } from '@/core/components/ui/alert';
import { cn } from '@/shared/lib/utils';

import {
  CreateEmployeeInput,
  EmploymentType,
} from '../../types/employee.types';
import {
  EMPLOYMENT_TYPE_LABELS,
  MARITAL_STATUS_LABELS,
} from '../../config/employee.constants';
import { useEmployee, useEmployeeActions, useEmployeeList } from '../../hooks/useEmployee';

const HR_COLOR = '#2196F3';

interface FormStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const STEPS: FormStep[] = [
  { id: 'personal', title: 'Personal', description: 'Basic information', icon: <User className="h-4 w-4" /> },
  { id: 'contact', title: 'Contact', description: 'Contact details', icon: <Phone className="h-4 w-4" /> },
  { id: 'employment', title: 'Employment', description: 'Job details', icon: <Briefcase className="h-4 w-4" /> },
  { id: 'documents', title: 'Documents', description: 'Contracts & files', icon: <FileText className="h-4 w-4" /> },
  { id: 'review', title: 'Review', description: 'Confirm & submit', icon: <CheckCircle className="h-4 w-4" /> },
];

interface DocumentItem {
  id: string;
  name: string;
  type: 'contract' | 'id' | 'certificate' | 'other';
  file?: File;
  url?: string;
  expiryDate?: string;
  notes?: string;
}

const DOCUMENT_TYPES = [
  { value: 'contract', label: 'Employment Contract' },
  { value: 'id', label: 'National ID / Passport' },
  { value: 'certificate', label: 'Certificate / Qualification' },
  { value: 'other', label: 'Other Document' },
];

// Helper to safely convert dates from various formats
function safeToDateString(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value.split('T')[0];
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value.toDate === 'function') return value.toDate().toISOString().split('T')[0];
  if (value.seconds !== undefined) return new Date(value.seconds * 1000).toISOString().split('T')[0];
  return '';
}

interface EmployeeFormProps {
  mode: 'create' | 'edit';
}

export const EmployeeForm: React.FC<EmployeeFormProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();
  
  const [activeStep, setActiveStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<CreateEmployeeInput>>({
    employmentType: 'probation' as EmploymentType,
  });
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Salary state
  const [salaryData, setSalaryData] = useState({
    basicSalary: '',
    housingAllowance: '',
    transportAllowance: '',
    lunchAllowance: '',
    otherAllowances: '',
    currency: 'UGX',
  });
  
  // Net-to-Gross calculator state
  const [netSalaryInput, setNetSalaryInput] = useState('');
  const [salaryMode, setSalaryMode] = useState<'gross' | 'net'>('net'); // Default to net (how negotiations happen)
  
  // Calculate gross from desired net salary (reverse tax calculation)
  const calculateGrossFromNet = (desiredNet: number): number => {
    if (desiredNet <= 0) return 0;
    
    // Binary search approach for more stable convergence
    let low = desiredNet;
    let high = desiredNet * 2; // Max gross is 2x net (covers high tax scenarios)
    const tolerance = 100; // UGX tolerance
    const maxIterations = 50;
    
    // Helper to calculate net from gross
    const getNetFromGross = (gross: number): number => {
      // NSSF: 5% employee contribution
      const nssf = gross * 0.05;
      
      // LST based on annual income
      let lstMonthly = 0;
      const annualGross = gross * 12;
      if (annualGross > 4800000 && annualGross <= 12000000) lstMonthly = 5000 / 12;
      else if (annualGross > 12000000 && annualGross <= 24000000) lstMonthly = 10000 / 12;
      else if (annualGross > 24000000 && annualGross <= 36000000) lstMonthly = 20000 / 12;
      else if (annualGross > 36000000 && annualGross <= 48000000) lstMonthly = 40000 / 12;
      else if (annualGross > 48000000 && annualGross <= 60000000) lstMonthly = 60000 / 12;
      else if (annualGross > 60000000 && annualGross <= 120000000) lstMonthly = 80000 / 12;
      else if (annualGross > 120000000) lstMonthly = 100000 / 12;
      
      // PAYE calculation (Uganda progressive rates)
      let paye = 0;
      if (gross > 235000) {
        if (gross <= 335000) {
          paye = (gross - 235000) * 0.10;
        } else if (gross <= 410000) {
          paye = (100000 * 0.10) + ((gross - 335000) * 0.20);
        } else if (gross <= 10000000) {
          paye = (100000 * 0.10) + (75000 * 0.20) + ((gross - 410000) * 0.30);
        } else {
          paye = (100000 * 0.10) + (75000 * 0.20) + (9590000 * 0.30) + ((gross - 10000000) * 0.40);
        }
      }
      
      return gross - nssf - lstMonthly - paye;
    };
    
    // Binary search to find the gross that gives desired net
    for (let i = 0; i < maxIterations; i++) {
      const mid = (low + high) / 2;
      const calculatedNet = getNetFromGross(mid);
      
      if (Math.abs(calculatedNet - desiredNet) < tolerance) {
        return Math.round(mid);
      }
      
      if (calculatedNet < desiredNet) {
        low = mid;
      } else {
        high = mid;
      }
    }
    
    return Math.round((low + high) / 2);
  };
  
  // Calculate estimated deductions for display
  const calculateDeductions = (gross: number) => {
    if (gross <= 0) return { paye: 0, nssf: 0, lst: 0, net: 0 };
    
    const nssf = gross * 0.05;
    
    let lstMonthly = 0;
    const annualGross = gross * 12;
    if (annualGross > 4800000 && annualGross <= 12000000) lstMonthly = 5000 / 12 * 12 / 12;
    else if (annualGross > 12000000 && annualGross <= 24000000) lstMonthly = 10000 / 12;
    else if (annualGross > 24000000 && annualGross <= 36000000) lstMonthly = 20000 / 12;
    else if (annualGross > 36000000 && annualGross <= 48000000) lstMonthly = 40000 / 12;
    else if (annualGross > 48000000 && annualGross <= 60000000) lstMonthly = 60000 / 12;
    else if (annualGross > 60000000 && annualGross <= 120000000) lstMonthly = 80000 / 12;
    else if (annualGross > 120000000) lstMonthly = 100000 / 12;
    
    let paye = 0;
    if (gross > 410000) {
      if (gross <= 335000) {
        paye = (gross - 235000) * 0.10;
      } else if (gross <= 410000) {
        paye = (100000 * 0.10) + ((gross - 335000) * 0.20);
      } else if (gross <= 10000000) {
        paye = (100000 * 0.10) + (75000 * 0.20) + ((gross - 410000) * 0.30);
      } else {
        paye = (100000 * 0.10) + (75000 * 0.20) + (9590000 * 0.30) + ((gross - 10000000) * 0.40);
      }
    }
    
    return {
      paye: Math.round(paye),
      nssf: Math.round(nssf),
      lst: Math.round(lstMonthly),
      net: Math.round(gross - paye - nssf - lstMonthly),
    };
  };
  
  // Documents state
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [newDocument, setNewDocument] = useState<Partial<DocumentItem>>({
    type: 'contract',
  });

  // Fetch existing employee for edit mode
  const { employee, loading: employeeLoading } = useEmployee(
    mode === 'edit' ? employeeId || null : null
  );

  // Form actions
  const { createEmployee, updateEmployee, loading: actionLoading, error: actionError } = useEmployeeActions('system');

  // Get all employees for "Reports To" dropdown
  const { employees: allEmployees } = useEmployeeList();
  
  // Filter out current employee (can't report to self) and get active employees
  const reportingOptions = (allEmployees || []).filter(emp => 
    emp.id !== employeeId && 
    (emp.employmentStatus === 'active' || emp.employmentStatus === 'probation')
  ).sort((a, b) => a.fullName.localeCompare(b.fullName));

  // Populate form with existing data in edit mode
  useEffect(() => {
    if (mode === 'edit' && employee) {
      setFormData({
        subsidiaryId: employee.subsidiaryId,
        firstName: employee.firstName,
        middleName: employee.middleName,
        lastName: employee.lastName,
        dateOfBirth: safeToDateString(employee.dateOfBirth),
        gender: employee.gender,
        maritalStatus: employee.maritalStatus,
        nationality: employee.nationality,
        religion: employee.religion,
        email: employee.email,
        position: {
          title: employee.position.title,
          departmentId: employee.position.departmentId,
          location: employee.position.location,
          isManagement: employee.position.isManagement,
          reportingTo: employee.position.reportingTo,
        },
        employmentType: employee.employmentType,
        joiningDate: safeToDateString(employee.employmentDates?.joiningDate),
      });
      // Set phone number from employee data
      if (employee.phoneNumbers && employee.phoneNumbers.length > 0) {
        setPhoneNumber(employee.phoneNumbers[0].number || '');
      }
      if (employee.photoUrl) {
        setPhotoPreview(employee.photoUrl);
      }
      // Load salary data from customFields
      if (employee.customFields) {
        setSalaryData({
          basicSalary: String(employee.customFields.basicSalary || ''),
          housingAllowance: String(employee.customFields.housingAllowance || ''),
          transportAllowance: String(employee.customFields.transportAllowance || ''),
          lunchAllowance: String(employee.customFields.lunchAllowance || ''),
          otherAllowances: String(employee.customFields.otherAllowances || ''),
          currency: employee.customFields.currency || 'UGX',
        });
      }
    }
  }, [mode, employee]);

  // Document handlers
  const handleAddDocument = () => {
    if (newDocument.name && newDocument.type) {
      const doc: DocumentItem = {
        id: `doc_${Date.now()}`,
        name: newDocument.name,
        type: newDocument.type as DocumentItem['type'],
        expiryDate: newDocument.expiryDate,
        notes: newDocument.notes,
        file: newDocument.file,
      };
      setDocuments(prev => [...prev, doc]);
      setNewDocument({ type: 'contract' });
    }
  };

  const handleRemoveDocument = (docId: string) => {
    setDocuments(prev => prev.filter(d => d.id !== docId));
  };

  const handleDocumentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewDocument(prev => ({ ...prev, file, name: prev.name || file.name }));
    }
  };

  // Validation
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0: // Personal Info
        return !!(formData.subsidiaryId && formData.firstName && formData.lastName && formData.gender);
      case 1: // Contact Details
        return !!(formData.email && phoneNumber);
      case 2: // Employment Details
        return !!(formData.position?.title && formData.position?.departmentId && formData.employmentType);
      case 3: // Documents - optional, always valid
        return true;
      default:
        return true;
    }
  };

  // Navigation handlers
  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleCancel = () => {
    navigate('/hr/employees');
  };

  // Form field handlers
  const handleTextChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSelectChange = (field: string) => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePositionChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement> | string) => {
    const value = typeof e === 'string' ? e : e.target.value;
    setFormData(prev => ({
      ...prev,
      position: {
        ...prev.position,
        [field]: value,
      } as any,
    }));
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPhotoPreview(result);
        setFormData(prev => ({ ...prev, photoUrl: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Form submission
  const handleSubmit = async () => {
    setSubmitError(null);

    try {
      if (mode === 'create') {
        // Calculate default date of birth (25 years ago) for validation
        const defaultDOB = new Date();
        defaultDOB.setFullYear(defaultDOB.getFullYear() - 25);
        
        // Format dates as ISO datetime with Z suffix
        const formatDateToISO = (dateStr: string | undefined): string => {
          if (dateStr) {
            return new Date(dateStr).toISOString();
          }
          return new Date().toISOString();
        };

        // Build complete input with defaults for optional fields
        // Note: Firestore doesn't accept undefined values, so we use empty strings or omit optional fields
        // Parse salary data
        const basicSalary = parseInt(salaryData.basicSalary) || 0;
        const housingAllowance = parseInt(salaryData.housingAllowance) || 0;
        const transportAllowance = parseInt(salaryData.transportAllowance) || 0;
        const lunchAllowance = parseInt(salaryData.lunchAllowance) || 0;
        const otherAllowances = parseInt(salaryData.otherAllowances) || 0;

        const completeInput: CreateEmployeeInput = {
          subsidiaryId: formData.subsidiaryId!,
          firstName: formData.firstName!,
          middleName: formData.middleName || '', // Empty string instead of undefined
          lastName: formData.lastName!,
          dateOfBirth: formData.dateOfBirth 
            ? new Date(formData.dateOfBirth).toISOString() 
            : defaultDOB.toISOString(),
          gender: formData.gender!,
          nationality: formData.nationality || 'Ugandan',
          email: formData.email!,
          phoneNumbers: phoneNumber ? [{ type: 'mobile' as const, number: phoneNumber, countryCode: '+256' }] : [],
          employmentType: formData.employmentType!,
          position: {
            title: formData.position?.title || '',
            departmentId: (formData.position?.departmentId || 'operations') as any,
            location: formData.position?.location || 'Kampala HQ',
            isManagement: formData.position?.isManagement || false,
            reportingTo: formData.position?.reportingTo || undefined,
          },
          joiningDate: formatDateToISO(formData.joiningDate),
          personalEmail: formData.personalEmail || undefined,
          maritalStatus: formData.maritalStatus || undefined,
          photoUrl: formData.photoUrl || undefined,
          // Include salary data in customFields for payroll
          customFields: {
            basicSalary,
            housingAllowance,
            transportAllowance,
            lunchAllowance,
            otherAllowances,
            grossSalary: basicSalary + housingAllowance + transportAllowance + lunchAllowance + otherAllowances,
            currency: 'UGX',
          },
        };
        
        // Remove undefined values before sending to Firestore
        const cleanedInput = JSON.parse(JSON.stringify(completeInput));
        
        await createEmployee(cleanedInput);
        navigate('/hr/employees'); // Navigate to employee list (detail page doesn't exist yet)
      } else if (employeeId) {
        // Parse salary data for update
        const basicSalary = parseInt(salaryData.basicSalary) || 0;
        const housingAllowance = parseInt(salaryData.housingAllowance) || 0;
        const transportAllowance = parseInt(salaryData.transportAllowance) || 0;
        const lunchAllowance = parseInt(salaryData.lunchAllowance) || 0;
        const otherAllowances = parseInt(salaryData.otherAllowances) || 0;
        
        const updateData = {
          ...formData,
          customFields: {
            basicSalary,
            housingAllowance,
            transportAllowance,
            lunchAllowance,
            otherAllowances,
            grossSalary: basicSalary + housingAllowance + transportAllowance + lunchAllowance + otherAllowances,
            currency: 'UGX',
          },
        };
        await updateEmployee(employeeId, updateData as any);
        navigate('/hr/employees'); // Navigate to employee list
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save employee';
      setSubmitError(errorMessage);
    }
  };

  // Loading state for edit mode
  if (mode === 'edit' && employeeLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not found state for edit mode
  if (mode === 'edit' && !employee && !employeeLoading) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Employee not found</AlertDescription>
      </Alert>
    );
  }

  const isLastStep = activeStep === STEPS.length - 1;
  const currentStep = STEPS[activeStep];

  return (
    <div className="space-y-6">
      {/* Segmented Progress Bar - Capital Hub Style */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-3">Form Progress</p>
          <div className="flex gap-1">
            {STEPS.map((step, index) => {
              const isCompleted = index < activeStep;
              const isCurrent = index === activeStep;
              return (
                <div
                  key={step.id}
                  className={cn(
                    'flex-1 h-2 rounded-full transition-all cursor-pointer hover:opacity-80',
                    isCompleted ? 'bg-green-500' : isCurrent ? 'bg-blue-500' : 'bg-gray-200'
                  )}
                  style={isCurrent ? { backgroundColor: HR_COLOR } : {}}
                  title={step.title}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-3">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-1.5 text-xs transition-colors',
                  index < activeStep
                    ? 'text-green-600'
                    : index === activeStep
                    ? 'text-blue-600 font-medium'
                    : 'text-muted-foreground'
                )}
                style={index === activeStep ? { color: HR_COLOR } : {}}
              >
                <div className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium',
                  index < activeStep
                    ? 'bg-green-100 text-green-700'
                    : index === activeStep
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500'
                )}
                style={index === activeStep ? { backgroundColor: `${HR_COLOR}20`, color: HR_COLOR } : {}}
                >
                  {index < activeStep ? <Check className="h-3 w-3" /> : index + 1}
                </div>
                <span className="hidden sm:inline">{step.title}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error alert */}
      {(submitError || actionError) && (
        <Alert variant="destructive">
          <AlertDescription>{submitError || actionError?.message}</AlertDescription>
        </Alert>
      )}

      {/* Form content */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: HR_COLOR }}
            >
              {currentStep.icon}
            </div>
            <div>
              <CardTitle className="text-xl">{currentStep.title}</CardTitle>
              <CardDescription>{currentStep.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 0: Personal Information */}
          {activeStep === 0 && (
            <>
              {/* Photo upload - Enhanced */}
              <div className="flex items-start gap-6 p-4 bg-muted/30 rounded-lg">
                <div className="relative">
                  <div className="w-28 h-28 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-md">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-semibold text-blue-400">
                        {formData.firstName?.[0] || '?'}{formData.lastName?.[0] || ''}
                      </span>
                    )}
                  </div>
                  {photoPreview && (
                    <button
                      onClick={() => { setPhotoPreview(null); setFormData(prev => ({ ...prev, photoUrl: undefined })); }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium mb-1">Profile Photo</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Upload a professional photo for the employee profile.
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <label className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      {photoPreview ? 'Change Photo' : 'Upload Photo'}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handlePhotoChange}
                      />
                    </label>
                  </Button>
                </div>
              </div>

              {/* Organization Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Subsidiary <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.subsidiaryId || ''} onValueChange={handleSelectChange('subsidiaryId')}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select which company this employee belongs to" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="group">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-800" />
                        Dawin Group (Shared Roles)
                      </div>
                    </SelectItem>
                    <SelectItem value="finishes">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        Dawin Finishes
                      </div>
                    </SelectItem>
                    <SelectItem value="advisory">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        Dawin Advisory
                      </div>
                    </SelectItem>
                    <SelectItem value="technology">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        Dawin Technology
                      </div>
                    </SelectItem>
                    <SelectItem value="capital">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        Dawin Capital
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={formData.firstName || ''}
                    onChange={handleTextChange('firstName')}
                    placeholder="Enter first name"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Middle Name</Label>
                  <Input
                    value={formData.middleName || ''}
                    onChange={handleTextChange('middleName')}
                    placeholder="Enter middle name"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={formData.lastName || ''}
                    onChange={handleTextChange('lastName')}
                    placeholder="Enter last name"
                    className="h-11"
                  />
                </div>
              </div>

              {/* Personal Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Date of Birth
                  </Label>
                  <Input
                    type="date"
                    value={formData.dateOfBirth || ''}
                    onChange={handleTextChange('dateOfBirth')}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Gender <span className="text-red-500">*</span>
                  </Label>
                  <Select value={formData.gender || ''} onValueChange={handleSelectChange('gender')}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Marital Status</Label>
                  <Select value={formData.maritalStatus || ''} onValueChange={handleSelectChange('maritalStatus')}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MARITAL_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Nationality</Label>
                  <Input
                    value={formData.nationality || ''}
                    onChange={handleTextChange('nationality')}
                    placeholder="e.g., Ugandan"
                    className="h-11"
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 1: Contact Details */}
          {activeStep === 1 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Work Email */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Work Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={formData.email || ''}
                    onChange={handleTextChange('email')}
                    placeholder="name@dawin.ug"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be the primary email for all work-related communications
                  </p>
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+256 700 000 000"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Primary mobile number for the employee
                  </p>
                </div>

                {/* Personal Email */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Personal Email</Label>
                  <Input
                    type="email"
                    value={formData.personalEmail || ''}
                    onChange={handleTextChange('personalEmail')}
                    placeholder="personal@email.com"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional backup contact email
                  </p>
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> Additional phone numbers, emergency contacts, and addresses can be added after creating the employee profile.
                </p>
              </div>
            </>
          )}

          {/* Step 2: Employment Details */}
          {activeStep === 2 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Job Title */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    Job Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={formData.position?.title || ''}
                    onChange={(e) => handlePositionChange('title')(e)}
                    placeholder="e.g., Senior Designer"
                    className="h-11"
                  />
                </div>
                
                {/* Department */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Department <span className="text-red-500">*</span>
                  </Label>
                  <Select 
                    value={formData.position?.departmentId || ''} 
                    onValueChange={(value) => handlePositionChange('departmentId')(value)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="executive">Executive</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="hr">Human Resources</SelectItem>
                      <SelectItem value="it">IT</SelectItem>
                      <SelectItem value="operations">Operations</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                      <SelectItem value="design">Design</SelectItem>
                      <SelectItem value="quality">Quality</SelectItem>
                      <SelectItem value="logistics">Logistics</SelectItem>
                      <SelectItem value="procurement">Procurement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Employment Type */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Employment Type <span className="text-red-500">*</span>
                  </Label>
                  <Select value={formData.employmentType || ''} onValueChange={handleSelectChange('employmentType')}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Work Location */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Work Location
                  </Label>
                  <Input
                    value={formData.position?.location || ''}
                    onChange={(e) => handlePositionChange('location')(e)}
                    placeholder="e.g., Kampala HQ"
                    className="h-11"
                  />
                </div>

                {/* Reports To */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Reports To
                  </Label>
                  <Select 
                    value={formData.position?.reportingTo || 'none'} 
                    onValueChange={(value) => handlePositionChange('reportingTo')(value === 'none' ? '' : value)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No direct manager</SelectItem>
                      {reportingOptions.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.fullName} - {emp.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select the employee's direct manager for org chart hierarchy
                  </p>
                </div>

                {/* Joining Date */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Joining Date
                  </Label>
                  <Input
                    type="date"
                    value={formData.joiningDate || ''}
                    onChange={handleTextChange('joiningDate')}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    The date the employee will start or started working
                  </p>
                </div>
              </div>

              {/* Salary & Compensation Section */}
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-green-800 dark:text-green-300 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Salary & Compensation
                  </h4>
                  {/* Mode Toggle */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className={salaryMode === 'net' ? 'text-green-700 font-medium' : 'text-muted-foreground'}>
                      Enter Net Pay
                    </span>
                    <button
                      type="button"
                      onClick={() => setSalaryMode(salaryMode === 'net' ? 'gross' : 'net')}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        salaryMode === 'gross' ? 'bg-green-600' : 'bg-gray-300'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                          salaryMode === 'gross' ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                    <span className={salaryMode === 'gross' ? 'text-green-700 font-medium' : 'text-muted-foreground'}>
                      Enter Gross Pay
                    </span>
                  </div>
                </div>

                {/* Net-to-Gross Calculator Mode */}
                {salaryMode === 'net' && (
                  <div className="mb-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-green-300">
                    <Label className="text-sm font-medium text-green-800 dark:text-green-300 mb-2 block">
                      Desired Net Salary (Take-home pay) <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-4 items-start">
                      <div className="flex-1">
                        <Input
                          type="number"
                          value={netSalaryInput}
                          onChange={(e) => {
                            setNetSalaryInput(e.target.value);
                            const netValue = parseInt(e.target.value) || 0;
                            if (netValue > 0) {
                              const calculatedGross = calculateGrossFromNet(netValue);
                              setSalaryData(prev => ({ ...prev, basicSalary: calculatedGross.toString() }));
                            }
                          }}
                          placeholder="e.g., 2,000,000"
                          className="h-12 text-lg"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter the net salary you negotiated with the employee
                        </p>
                      </div>
                      <div className="text-center px-4">
                        <div className="text-2xl text-muted-foreground">→</div>
                      </div>
                      <div className="flex-1">
                        <div className="h-12 px-4 rounded-md border-2 border-green-500 bg-green-50 dark:bg-green-950 flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Required Gross:</span>
                          <span className="text-lg font-bold text-green-700 dark:text-green-400">
                            UGX {(parseInt(salaryData.basicSalary) || 0).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          This gross salary will yield the desired net after deductions
                        </p>
                      </div>
                    </div>
                    
                    {/* Deduction Breakdown */}
                    {parseInt(salaryData.basicSalary) > 0 && (
                      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Estimated Monthly Deductions:</p>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">PAYE</p>
                            <p className="font-medium text-red-600">
                              -UGX {calculateDeductions(parseInt(salaryData.basicSalary)).paye.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">NSSF (5%)</p>
                            <p className="font-medium text-red-600">
                              -UGX {calculateDeductions(parseInt(salaryData.basicSalary)).nssf.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">LST</p>
                            <p className="font-medium text-red-600">
                              -UGX {calculateDeductions(parseInt(salaryData.basicSalary)).lst.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Net Pay</p>
                            <p className="font-bold text-green-600">
                              UGX {calculateDeductions(parseInt(salaryData.basicSalary)).net.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Gross Mode - Direct Entry */}
                {salaryMode === 'gross' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Basic Salary */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Basic/Gross Salary (UGX) <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="number"
                        value={salaryData.basicSalary}
                        onChange={(e) => setSalaryData(prev => ({ ...prev, basicSalary: e.target.value }))}
                        placeholder="e.g., 2,500,000"
                        className="h-11"
                      />
                    </div>

                    {/* Housing Allowance */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Housing Allowance</Label>
                      <Input
                        type="number"
                        value={salaryData.housingAllowance}
                        onChange={(e) => setSalaryData(prev => ({ ...prev, housingAllowance: e.target.value }))}
                        placeholder="e.g., 500,000"
                        className="h-11"
                      />
                    </div>

                    {/* Transport Allowance */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Transport Allowance</Label>
                      <Input
                        type="number"
                        value={salaryData.transportAllowance}
                        onChange={(e) => setSalaryData(prev => ({ ...prev, transportAllowance: e.target.value }))}
                        placeholder="e.g., 300,000"
                        className="h-11"
                      />
                    </div>

                    {/* Lunch Allowance */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Lunch Allowance</Label>
                      <Input
                        type="number"
                        value={salaryData.lunchAllowance}
                        onChange={(e) => setSalaryData(prev => ({ ...prev, lunchAllowance: e.target.value }))}
                        placeholder="e.g., 200,000"
                        className="h-11"
                      />
                    </div>

                    {/* Other Allowances */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Other Allowances</Label>
                      <Input
                        type="number"
                        value={salaryData.otherAllowances}
                        onChange={(e) => setSalaryData(prev => ({ ...prev, otherAllowances: e.target.value }))}
                        placeholder="e.g., 100,000"
                        className="h-11"
                      />
                    </div>

                    {/* Calculated Net Pay */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Net Pay (Calculated)</Label>
                      <div className="h-11 px-3 rounded-md border bg-muted flex items-center font-medium text-green-700 dark:text-green-400">
                        UGX {calculateDeductions(
                          (parseInt(salaryData.basicSalary) || 0) +
                          (parseInt(salaryData.housingAllowance) || 0) +
                          (parseInt(salaryData.transportAllowance) || 0) +
                          (parseInt(salaryData.lunchAllowance) || 0) +
                          (parseInt(salaryData.otherAllowances) || 0)
                        ).net.toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-xs text-green-700 dark:text-green-400 mt-3">
                  Tax deductions (PAYE, NSSF, LST) calculated using Uganda tax rates. NSSF employer contribution (10%) is separate.
                </p>
              </div>
            </>
          )}

          {/* Step 3: Documents & Contracts */}
          {activeStep === 3 && (
            <>
              {/* Add New Document */}
              <div className="p-4 bg-muted/30 rounded-lg space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Document
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Document Type</Label>
                    <Select 
                      value={newDocument.type || 'contract'} 
                      onValueChange={(value) => setNewDocument(prev => ({ ...prev, type: value as DocumentItem['type'] }))}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Document Name</Label>
                    <Input
                      value={newDocument.name || ''}
                      onChange={(e) => setNewDocument(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Employment Contract 2026"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Expiry Date (Optional)</Label>
                    <Input
                      type="date"
                      value={newDocument.expiryDate || ''}
                      onChange={(e) => setNewDocument(prev => ({ ...prev, expiryDate: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">File</Label>
                    <Input
                      type="file"
                      onChange={handleDocumentFileChange}
                      className="h-10"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Notes (Optional)</Label>
                  <Textarea
                    value={newDocument.notes || ''}
                    onChange={(e) => setNewDocument(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any additional notes about this document..."
                    rows={2}
                  />
                </div>
                <Button 
                  onClick={handleAddDocument}
                  disabled={!newDocument.name}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Document
                </Button>
              </div>

              {/* Document List */}
              {documents.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-medium">Added Documents ({documents.length})</h4>
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div 
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-card border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{doc.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="secondary" className="text-xs">
                                {DOCUMENT_TYPES.find(t => t.value === doc.type)?.label || doc.type}
                              </Badge>
                              {doc.expiryDate && (
                                <span>Expires: {new Date(doc.expiryDate).toLocaleDateString()}</span>
                              )}
                              {doc.file && (
                                <span className="text-green-600">File attached</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveDocument(doc.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No documents added yet</p>
                  <p className="text-sm">Add employment contracts, ID copies, or other documents above</p>
                </div>
              )}

              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>Tip:</strong> You can skip this step and add documents later from the employee profile. Common documents include employment contracts, national ID copies, academic certificates, and professional qualifications.
                </p>
              </div>
            </>
          )}

          {/* Step 4: Review */}
          {activeStep === 4 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Info Card */}
                <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                  <h4 className="font-medium flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider">
                    <User className="h-4 w-4" />
                    Personal Information
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Full Name</span>
                      <span className="font-medium">{formData.firstName} {formData.middleName} {formData.lastName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gender</span>
                      <span className="font-medium capitalize">{formData.gender || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nationality</span>
                      <span className="font-medium">{formData.nationality || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Contact Info Card */}
                <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                  <h4 className="font-medium flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider">
                    <Phone className="h-4 w-4" />
                    Contact Details
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Work Email</span>
                      <span className="font-medium">{formData.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone</span>
                      <span className="font-medium">{phoneNumber || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Employment Info Card */}
                <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                  <h4 className="font-medium flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider">
                    <Briefcase className="h-4 w-4" />
                    Employment Details
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Position</span>
                      <span className="font-medium">{formData.position?.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Department</span>
                      <span className="font-medium capitalize">{formData.position?.departmentId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">
                        {formData.employmentType ? EMPLOYMENT_TYPE_LABELS[formData.employmentType] : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subsidiary</span>
                      <Badge variant="outline" className="capitalize">{formData.subsidiaryId}</Badge>
                    </div>
                  </div>
                </div>

                {/* Documents Summary Card */}
                <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                  <h4 className="font-medium flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider">
                    <FileText className="h-4 w-4" />
                    Documents
                  </h4>
                  {documents.length > 0 ? (
                    <div className="space-y-1">
                      {documents.map(doc => (
                        <div key={doc.id} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>{doc.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No documents added</p>
                  )}
                </div>
              </div>

              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                <p className="text-sm text-green-700 dark:text-green-300">
                  <strong>Ready to submit!</strong> Please review the information above. Once submitted, you can make additional updates from the employee profile page.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <div className="flex gap-2">
          {activeStep > 0 && (
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
          )}
          {!isLastStep ? (
            <Button 
              onClick={handleNext}
              disabled={!validateStep(activeStep)}
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === 'create' ? 'Create Employee' : 'Save Changes'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeForm;
