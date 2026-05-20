// ============================================================================
// SKILLS HOOK
// DawinOS v2.0 - HR Module
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Skill,
  EmployeeSkillRecord,
  SkillGapAnalysis,
  TrainingProgram,
  TrainingEnrollment,
  SkillCertification,
  SkillFilters,
  TrainingProgramFilters,
} from '../types/skills.types';
import {
  SkillInput,
  EmployeeSkillInput,
  TrainingProgramInput,
  CertificationInput,
  TrainingCompletionInput,
  TrainingFeedbackInput,
} from '../schemas/skills.schemas';
import {
  createSkill,
  getSkills,
  updateSkill,
  deleteSkill,
  addEmployeeSkill,
  getEmployeeSkills,
  updateEmployeeSkill,
  verifyEmployeeSkill,
  deleteEmployeeSkill,
  analyzeSkillGaps,
  createTrainingProgram,
  getTrainingPrograms,
  updateTrainingProgram,
  publishTrainingProgram,
  enrollInTraining,
  getEmployeeEnrollments,
  approveEnrollment,
  rejectEnrollment,
  completeTraining,
  submitTrainingFeedback,
  addCertification,
  getEmployeeCertifications,
  getExpiringCertifications,
  verifyCertification,
} from '../services/skillsService';
import { useAuth } from '@/core/hooks/useAuth';
import { SkillLevel } from '../constants/skills.constants';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface UseSkillsOptions {
  companyId: string;
  employeeId?: string;
  autoLoad?: boolean;
}

interface UseSkillsReturn {
  // Data
  skills: Skill[];
  employeeSkills: EmployeeSkillRecord[];
  programs: TrainingProgram[];
  enrollments: TrainingEnrollment[];
  certifications: SkillCertification[];
  expiringCertifications: SkillCertification[];
  skillGapAnalysis: SkillGapAnalysis | null;
  
  // State
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  
  // Skill actions
  loadSkills: (filters?: SkillFilters) => Promise<void>;
  createSkillFn: (input: SkillInput) => Promise<Skill | null>;
  updateSkillFn: (skillId: string, input: Partial<SkillInput>) => Promise<boolean>;
  deleteSkillFn: (skillId: string) => Promise<boolean>;
  
  // Employee skill actions
  loadEmployeeSkills: (empId: string) => Promise<void>;
  addEmployeeSkillFn: (
    empId: string,
    input: EmployeeSkillInput,
    skillData: { name: string; category: string }
  ) => Promise<EmployeeSkillRecord | null>;
  updateEmployeeSkillFn: (recordId: string, input: Partial<EmployeeSkillInput>) => Promise<boolean>;
  verifyEmployeeSkillFn: (recordId: string, level: SkillLevel) => Promise<boolean>;
  deleteEmployeeSkillFn: (recordId: string) => Promise<boolean>;
  
  // Gap analysis
  runGapAnalysis: (
    empId: string,
    empName: string,
    positionId: string,
    positionTitle: string
  ) => Promise<SkillGapAnalysis | null>;
  
  // Training program actions
  loadPrograms: (filters?: TrainingProgramFilters) => Promise<void>;
  createProgramFn: (input: TrainingProgramInput) => Promise<TrainingProgram | null>;
  updateProgramFn: (programId: string, input: Partial<TrainingProgramInput>) => Promise<boolean>;
  publishProgramFn: (programId: string) => Promise<boolean>;
  
  // Enrollment actions
  loadEnrollments: (empId: string) => Promise<void>;
  enrollFn: (
    programId: string,
    employeeId: string,
    employeeData: { name: string; departmentId: string },
    programData: { title: string; costPerPerson: number },
    requiresApproval?: boolean
  ) => Promise<TrainingEnrollment | null>;
  approveEnrollmentFn: (enrollmentId: string) => Promise<boolean>;
  rejectEnrollmentFn: (enrollmentId: string, reason: string) => Promise<boolean>;
  completeTrainingFn: (enrollmentId: string, data: TrainingCompletionInput) => Promise<boolean>;
  submitFeedbackFn: (enrollmentId: string, feedback: TrainingFeedbackInput) => Promise<boolean>;
  
  // Certification actions
  loadCertifications: (empId: string) => Promise<void>;
  loadExpiringCertifications: (daysAhead?: number) => Promise<void>;
  addCertificationFn: (input: CertificationInput, employeeName: string) => Promise<SkillCertification | null>;
  verifyCertificationFn: (certId: string, documentUrl?: string) => Promise<boolean>;
}

// ----------------------------------------------------------------------------
// HOOK
// ----------------------------------------------------------------------------

export const useSkills = ({
  companyId,
  employeeId,
  autoLoad = true,
}: UseSkillsOptions): UseSkillsReturn => {
  const { user } = useAuth();
  
  // State
  const [skills, setSkills] = useState<Skill[]>([]);
  const [employeeSkills, setEmployeeSkills] = useState<EmployeeSkillRecord[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [certifications, setCertifications] = useState<SkillCertification[]>([]);
  const [expiringCertifications, setExpiringCertifications] = useState<SkillCertification[]>([]);
  const [skillGapAnalysis, setSkillGapAnalysis] = useState<SkillGapAnalysis | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load skills
  const loadSkills = useCallback(async (filters: SkillFilters = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSkills(companyId, filters);
      setSkills(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  // Create skill
  const createSkillFn = useCallback(async (input: SkillInput): Promise<Skill | null> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const skill = await createSkill(companyId, input);
      setSkills(prev => [...prev, skill]);
      return skill;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create skill');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [companyId]);
  
  // Update skill
  const updateSkillFn = useCallback(async (skillId: string, input: Partial<SkillInput>): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    try {
      await updateSkill(skillId, input);
      await loadSkills();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update skill');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [loadSkills]);
  
  // Delete skill
  const deleteSkillFn = useCallback(async (skillId: string): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    try {
      await deleteSkill(skillId);
      setSkills(prev => prev.filter(s => s.id !== skillId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete skill');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);
  
  // Load employee skills
  const loadEmployeeSkills = useCallback(async (empId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getEmployeeSkills(companyId, empId);
      setEmployeeSkills(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employee skills');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  // Add employee skill
  const addEmployeeSkillFn = useCallback(async (
    empId: string,
    input: EmployeeSkillInput,
    skillData: { name: string; category: string }
  ): Promise<EmployeeSkillRecord | null> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const record = await addEmployeeSkill(companyId, empId, input, skillData);
      setEmployeeSkills(prev => [...prev, record]);
      return record;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add skill');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [companyId]);
  
  // Update employee skill
  const updateEmployeeSkillFn = useCallback(async (
    recordId: string,
    input: Partial<EmployeeSkillInput>
  ): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    try {
      await updateEmployeeSkill(recordId, input);
      if (employeeId) await loadEmployeeSkills(employeeId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update skill');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [employeeId, loadEmployeeSkills]);
  
  // Verify employee skill
  const verifyEmployeeSkillFn = useCallback(async (
    recordId: string,
    level: SkillLevel
  ): Promise<boolean> => {
    if (!user) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      await verifyEmployeeSkill(recordId, level, user.uid);
      if (employeeId) await loadEmployeeSkills(employeeId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify skill');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [user, employeeId, loadEmployeeSkills]);
  
  // Delete employee skill
  const deleteEmployeeSkillFn = useCallback(async (recordId: string): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    try {
      await deleteEmployeeSkill(recordId);
      setEmployeeSkills(prev => prev.filter(s => s.id !== recordId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete skill');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);
  
  // Run gap analysis
  const runGapAnalysis = useCallback(async (
    empId: string,
    empName: string,
    positionId: string,
    positionTitle: string
  ): Promise<SkillGapAnalysis | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const analysis = await analyzeSkillGaps(companyId, empId, empName, positionId, positionTitle);
      setSkillGapAnalysis(analysis);
      return analysis;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze skill gaps');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  // Load programs
  const loadPrograms = useCallback(async (filters: TrainingProgramFilters = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTrainingPrograms(companyId, filters);
      setPrograms(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load programs');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  // Create program
  const createProgramFn = useCallback(async (input: TrainingProgramInput): Promise<TrainingProgram | null> => {
    if (!user) return null;
    setIsSubmitting(true);
    setError(null);
    try {
      const program = await createTrainingProgram(companyId, input, user.uid);
      setPrograms(prev => [program, ...prev]);
      return program;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create program');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [companyId, user]);
  
  // Update program
  const updateProgramFn = useCallback(async (
    programId: string,
    input: Partial<TrainingProgramInput>
  ): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    try {
      await updateTrainingProgram(programId, input);
      await loadPrograms();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update program');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [loadPrograms]);
  
  // Publish program
  const publishProgramFn = useCallback(async (programId: string): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    try {
      await publishTrainingProgram(programId);
      await loadPrograms();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish program');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [loadPrograms]);
  
  // Load enrollments
  const loadEnrollments = useCallback(async (empId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getEmployeeEnrollments(companyId, empId);
      setEnrollments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enrollments');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  // Enroll in training
  const enrollFn = useCallback(async (
    programId: string,
    empId: string,
    employeeData: { name: string; departmentId: string },
    programData: { title: string; costPerPerson: number },
    requiresApproval: boolean = true
  ): Promise<TrainingEnrollment | null> => {
    if (!user) return null;
    setIsSubmitting(true);
    setError(null);
    try {
      const enrollment = await enrollInTraining(
        companyId, programId, empId, employeeData, programData, user.uid, requiresApproval
      );
      setEnrollments(prev => [enrollment, ...prev]);
      return enrollment;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [companyId, user]);
  
  // Approve enrollment
  const approveEnrollmentFn = useCallback(async (enrollmentId: string): Promise<boolean> => {
    if (!user) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      await approveEnrollment(enrollmentId, user.uid);
      if (employeeId) await loadEnrollments(employeeId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve enrollment');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [user, employeeId, loadEnrollments]);
  
  // Reject enrollment
  const rejectEnrollmentFn = useCallback(async (enrollmentId: string, reason: string): Promise<boolean> => {
    if (!user) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      await rejectEnrollment(enrollmentId, user.uid, reason);
      if (employeeId) await loadEnrollments(employeeId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject enrollment');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [user, employeeId, loadEnrollments]);
  
  // Complete training
  const completeTrainingFn = useCallback(async (
    enrollmentId: string,
    data: TrainingCompletionInput
  ): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    try {
      await completeTraining(enrollmentId, data);
      if (employeeId) await loadEnrollments(employeeId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete training');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [employeeId, loadEnrollments]);
  
  // Submit feedback
  const submitFeedbackFn = useCallback(async (
    enrollmentId: string,
    feedback: TrainingFeedbackInput
  ): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    try {
      await submitTrainingFeedback(enrollmentId, feedback);
      if (employeeId) await loadEnrollments(employeeId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [employeeId, loadEnrollments]);
  
  // Load certifications
  const loadCertifications = useCallback(async (empId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getEmployeeCertifications(companyId, empId);
      setCertifications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load certifications');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  // Load expiring certifications
  const loadExpiringCertifications = useCallback(async (daysAhead: number = 60) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getExpiringCertifications(companyId, daysAhead);
      setExpiringCertifications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expiring certifications');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  // Add certification
  const addCertificationFn = useCallback(async (
    input: CertificationInput,
    employeeName: string
  ): Promise<SkillCertification | null> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const cert = await addCertification(companyId, input, employeeName);
      setCertifications(prev => [...prev, cert]);
      return cert;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add certification');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [companyId]);
  
  // Verify certification
  const verifyCertificationFn = useCallback(async (
    certId: string,
    documentUrl?: string
  ): Promise<boolean> => {
    if (!user) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      await verifyCertification(certId, user.uid, documentUrl);
      if (employeeId) await loadCertifications(employeeId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify certification');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [user, employeeId, loadCertifications]);
  
  // Auto-load
  useEffect(() => {
    if (autoLoad && companyId) {
      loadSkills();
      loadPrograms();
      if (employeeId) {
        loadEmployeeSkills(employeeId);
        loadEnrollments(employeeId);
        loadCertifications(employeeId);
      }
    }
  }, [autoLoad, companyId, employeeId, loadSkills, loadPrograms, loadEmployeeSkills, loadEnrollments, loadCertifications]);
  
  return {
    skills,
    employeeSkills,
    programs,
    enrollments,
    certifications,
    expiringCertifications,
    skillGapAnalysis,
    isLoading,
    isSubmitting,
    error,
    loadSkills,
    createSkillFn,
    updateSkillFn,
    deleteSkillFn,
    loadEmployeeSkills,
    addEmployeeSkillFn,
    updateEmployeeSkillFn,
    verifyEmployeeSkillFn,
    deleteEmployeeSkillFn,
    runGapAnalysis,
    loadPrograms,
    createProgramFn,
    updateProgramFn,
    publishProgramFn,
    loadEnrollments,
    enrollFn,
    approveEnrollmentFn,
    rejectEnrollmentFn,
    completeTrainingFn,
    submitFeedbackFn,
    loadCertifications,
    loadExpiringCertifications,
    addCertificationFn,
    verifyCertificationFn,
  };
};
