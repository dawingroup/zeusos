// ============================================================================
// ORG STRUCTURE PAGE - DawinOS HR Central
// Organization chart / Organogram visualization
// ============================================================================

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Building2,
  ChevronDown,
  ChevronRight,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  User,
  Mail,
  Phone,
  Briefcase,
  MapPin,
} from 'lucide-react';
import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Badge } from '@/core/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { Skeleton } from '@/core/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import { useEmployeeList } from '@/modules/hr-central/hooks/useEmployee';
import { EmployeeSummary } from '@/modules/hr-central/types/employee.types';

// ============================================================================
// Types
// ============================================================================

interface OrgNode {
  employee: EmployeeSummary;
  children: OrgNode[];
  level: number;
  isExpanded: boolean;
}

type ViewMode = 'tree' | 'list' | 'grid';

// ============================================================================
// Simple Avatar Component
// ============================================================================

interface SimpleAvatarProps {
  src?: string;
  name: string;
  className?: string;
  isExecutive?: boolean;
}

function SimpleAvatar({ src, name, className, isExecutive }: SimpleAvatarProps) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div 
      className={cn(
        "flex items-center justify-center rounded-full font-medium",
        isExecutive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        className
      )}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full rounded-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildOrgTree(employees: EmployeeSummary[]): OrgNode[] {
  const employeeMap = new Map<string, EmployeeSummary>();
  const childrenMap = new Map<string, EmployeeSummary[]>();
  
  // Build maps
  employees.forEach(emp => {
    employeeMap.set(emp.id, emp);
    if (emp.reportingTo) {
      const children = childrenMap.get(emp.reportingTo) || [];
      children.push(emp);
      childrenMap.set(emp.reportingTo, children);
    }
  });
  
  // Find root nodes (no reporting to, or reporting to someone not in the list)
  const rootEmployees = employees.filter(emp => 
    !emp.reportingTo || !employeeMap.has(emp.reportingTo)
  );
  
  // Build tree recursively
  function buildNode(employee: EmployeeSummary, level: number): OrgNode {
    const children = childrenMap.get(employee.id) || [];
    return {
      employee,
      level,
      isExpanded: level < 2, // Expand first 2 levels by default
      children: children
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
        .map(child => buildNode(child, level + 1)),
    };
  }
  
  return rootEmployees
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map(emp => buildNode(emp, 0));
}

// ============================================================================
// Employee Card Component
// ============================================================================

interface EmployeeCardProps {
  node: OrgNode;
  onToggle: (id: string) => void;
  onSelect: (employee: EmployeeSummary) => void;
  zoom: number;
  expandedNodes: Set<string>;
}

function EmployeeCard({ node, onToggle, onSelect, zoom, expandedNodes }: EmployeeCardProps) {
  const { employee, children, level } = node;
  const hasChildren = children.length > 0;
  const isExpanded = expandedNodes.has(employee.id);
  
  const cardScale = Math.max(0.6, zoom);
  
  return (
    <div className="flex flex-col items-center">
      {/* Employee Card */}
      <div
        className={cn(
          "relative bg-card border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer",
          "min-w-[200px] max-w-[280px]",
          level === 0 && "border-primary/50 bg-primary/5"
        )}
        style={{ transform: `scale(${cardScale})`, transformOrigin: 'top center' }}
        onClick={() => onSelect(employee)}
      >
        {/* Connection line to parent */}
        {level > 0 && (
          <div className="absolute -top-6 left-1/2 w-px h-6 bg-border" />
        )}
        
        <div className="p-4">
          <div className="flex items-start gap-3">
            <SimpleAvatar 
              src={employee.photoUrl} 
              name={employee.fullName}
              className="h-12 w-12 border-2 border-background shadow text-sm"
              isExecutive={level === 0}
            />
            
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm truncate">{employee.fullName}</h4>
              <p className="text-xs text-muted-foreground truncate">{employee.title}</p>
              <div className="flex items-center gap-1 mt-1">
                <Badge variant="outline" className="text-xs px-1.5 py-0">
                  {employee.departmentId}
                </Badge>
                {hasChildren && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    <Users className="h-3 w-3 mr-0.5" />
                    {children.length}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Contact info */}
          <div className="mt-3 pt-3 border-t space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span className="truncate">{employee.email}</span>
            </div>
            {employee.phone && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span>{employee.phone}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Expand/Collapse button */}
        {hasChildren && (
          <button
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-background border rounded-full p-1 shadow hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(employee.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        )}
      </div>
      
      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-8 relative">
          {/* Horizontal line connecting children */}
          {children.length > 1 && (
            <div 
              className="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-border"
              style={{ 
                width: `${Math.min(children.length * 220, 800)}px`,
              }}
            />
          )}
          
          {/* Vertical line from parent */}
          <div className="absolute -top-2 left-1/2 w-px h-2 bg-border" />
          
          <div className="flex gap-6 justify-center flex-wrap">
            {children.map(child => (
              <EmployeeCard
                key={child.employee.id}
                node={child}
                onToggle={onToggle}
                onSelect={onSelect}
                zoom={zoom}
                expandedNodes={expandedNodes}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// List View Component
// ============================================================================

interface ListViewProps {
  nodes: OrgNode[];
  onSelect: (employee: EmployeeSummary) => void;
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
}

function ListView({ nodes, onSelect, expandedNodes, onToggle }: ListViewProps) {
  const renderNode = (node: OrgNode) => {
    const { employee, children, level } = node;
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(employee.id);
    
    return (
      <div key={employee.id}>
        <div
          className={cn(
            "flex items-center gap-3 p-3 hover:bg-muted/50 rounded-lg cursor-pointer border-b",
            level === 0 && "bg-primary/5"
          )}
          style={{ paddingLeft: `${level * 24 + 12}px` }}
          onClick={() => onSelect(employee)}
        >
          {hasChildren ? (
            <button
              className="p-1 hover:bg-muted rounded"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(employee.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}
          
          <SimpleAvatar 
            src={employee.photoUrl} 
            name={employee.fullName}
            className="h-10 w-10 text-sm"
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{employee.fullName}</span>
              {hasChildren && (
                <Badge variant="secondary" className="text-xs">
                  {children.length} reports
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{employee.title}</p>
          </div>
          
          <Badge variant="outline">{employee.departmentId}</Badge>
          
          <div className="text-sm text-muted-foreground">{employee.email}</div>
        </div>
        
        {hasChildren && isExpanded && children.map(child => renderNode(child))}
      </div>
    );
  };
  
  return (
    <div className="divide-y">
      {nodes.map(node => renderNode(node))}
    </div>
  );
}

// ============================================================================
// Employee Detail Panel
// ============================================================================

interface DetailPanelProps {
  employee: EmployeeSummary | null;
  onClose: () => void;
  onViewProfile: (id: string) => void;
}

function DetailPanel({ employee, onClose, onViewProfile }: DetailPanelProps) {
  if (!employee) return null;
  
  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-background border-l shadow-lg z-50 overflow-y-auto">
      <div className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <SimpleAvatar 
              src={employee.photoUrl} 
              name={employee.fullName}
              className="h-16 w-16 text-lg"
            />
            <div>
              <h2 className="text-xl font-semibold">{employee.fullName}</h2>
              <p className="text-muted-foreground">{employee.title}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Department</p>
              <p className="font-medium">{employee.departmentId}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Employment Status</p>
              <Badge variant={employee.employmentStatus === 'active' ? 'default' : 'secondary'}>
                {employee.employmentStatus}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{employee.email}</p>
            </div>
          </div>
          
          {employee.phone && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{employee.phone}</p>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Direct Reports</p>
              <p className="font-medium">{employee.directReports || 0}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Employee Number</p>
              <p className="font-medium">{employee.employeeNumber}</p>
            </div>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t">
          <Button 
            className="w-full" 
            onClick={() => onViewProfile(employee.id)}
          >
            <User className="h-4 w-4 mr-2" />
            View Full Profile
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function OrgStructurePage() {
  const navigate = useNavigate();
  const { employees, loading } = useEmployeeList();
  
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [zoom, setZoom] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSummary | null>(null);
  
  // Build org tree from employees
  const orgTree = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    
    // Filter by active/probation status
    let filtered = employees.filter(emp => 
      emp.employmentStatus === 'active' || emp.employmentStatus === 'probation'
    );
    
    // Filter by department
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(emp => emp.departmentId === departmentFilter);
    }
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(emp =>
        emp.fullName.toLowerCase().includes(query) ||
        emp.title.toLowerCase().includes(query) ||
        emp.email.toLowerCase().includes(query)
      );
    }
    
    const tree = buildOrgTree(filtered);
    
    // Initialize expanded nodes
    if (expandedNodes.size === 0 && tree.length > 0) {
      const initial = new Set<string>();
      tree.forEach(node => {
        initial.add(node.employee.id);
        node.children.forEach(child => initial.add(child.employee.id));
      });
      setExpandedNodes(initial);
    }
    
    return tree;
  }, [employees, departmentFilter, searchQuery]);
  
  // Get unique departments
  const departments = useMemo(() => {
    if (!employees) return [];
    const depts = new Set(employees.map(emp => emp.departmentId));
    return Array.from(depts).sort();
  }, [employees]);
  
  // Stats
  const stats = useMemo(() => {
    const activeEmployees = employees?.filter(emp => 
      emp.employmentStatus === 'active' || emp.employmentStatus === 'probation'
    ) || [];
    
    return {
      totalEmployees: activeEmployees.length,
      departments: new Set(activeEmployees.map(e => e.departmentId)).size,
      managers: activeEmployees.filter(e => e.directReports && e.directReports > 0).length,
    };
  }, [employees]);
  
  const handleToggle = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  const handleExpandAll = () => {
    const all = new Set<string>();
    const addAll = (nodes: OrgNode[]) => {
      nodes.forEach(node => {
        all.add(node.employee.id);
        addAll(node.children);
      });
    };
    addAll(orgTree);
    setExpandedNodes(all);
  };
  
  const handleCollapseAll = () => {
    const root = new Set<string>();
    orgTree.forEach(node => root.add(node.employee.id));
    setExpandedNodes(root);
  };
  
  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[600px]" />
      </div>
    );
  }
  
  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2">
            <Building2 className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            Organization Structure
          </h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            View the company organogram and reporting relationships
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExpandAll}>
            <Maximize2 className="h-3.5 w-3.5" /> Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={handleCollapseAll}>
            Collapse All
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalEmployees}</p>
                <p className="text-sm text-muted-foreground">Total Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.departments}</p>
                <p className="text-sm text-muted-foreground">Departments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <User className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.managers}</p>
                <p className="text-sm text-muted-foreground">Managers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Department Filter */}
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* View Mode */}
            <div className="flex items-center border rounded-lg">
              <Button
                variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('tree')}
              >
                Tree
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                List
              </Button>
            </div>
            
            {/* Zoom (Tree view only) */}
            {viewMode === 'tree' && (
              <div className="flex items-center gap-2 border rounded-lg px-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Org Chart */}
      <Card>
        <CardContent className="p-6 min-h-[500px] overflow-x-auto">
          {orgTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No employees found</h3>
              <p className="text-muted-foreground">
                {searchQuery || departmentFilter !== 'all' 
                  ? 'Try adjusting your filters'
                  : 'Add employees to see the organization structure'
                }
              </p>
            </div>
          ) : viewMode === 'tree' ? (
            <div className="flex flex-col items-center gap-8 pb-8">
              {orgTree.map(node => (
                <EmployeeCard
                  key={node.employee.id}
                  node={node}
                  onToggle={handleToggle}
                  onSelect={setSelectedEmployee}
                  zoom={zoom}
                  expandedNodes={expandedNodes}
                />
              ))}
            </div>
          ) : (
            <ListView
              nodes={orgTree}
              onSelect={setSelectedEmployee}
              expandedNodes={expandedNodes}
              onToggle={handleToggle}
            />
          )}
        </CardContent>
      </Card>
      
      {/* Detail Panel */}
      {selectedEmployee && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setSelectedEmployee(null)}
          />
          <DetailPanel
            employee={selectedEmployee}
            onClose={() => setSelectedEmployee(null)}
            onViewProfile={(id) => navigate(`/hr/employees/${id}`)}
          />
        </>
      )}
    </div>
  );
}
