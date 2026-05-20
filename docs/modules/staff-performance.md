# Staff Performance Module

## Overview

Staff Performance provides goal management, performance reviews, and competency tracking for employee development.

## Features

### Goal Setting
- Individual goal creation
- Goal cascading from OKRs
- Progress tracking
- Manager approval workflow

### Performance Reviews
- Review cycle management
- 360-degree feedback
- Self-assessments
- Manager evaluations

### Competency Framework
- Competency definitions
- Skill assessments
- Gap analysis
- Development planning

### Succession Planning
- Talent pipeline
- High-potential identification
- Career pathing
- Readiness assessments

## Review Cycle

```
Goal Setting → Mid-Year Review → Year-End Review → Calibration
```

## Permissions

| Permission | Description |
|------------|-------------|
| `performance:read` | View performance data |
| `performance:write` | Create/update reviews |
| `performance:admin` | Full performance access |
| `performance:approve` | Goal approval |

## Data Model

### Goal

```typescript
interface Goal {
  id: string;
  title: string;
  description: string;
  employeeUserId: string;
  linkedOkrId?: string;
  period: string;
  status: 'draft' | 'pending' | 'approved' | 'in_progress' | 'completed';
  progress: number;
  weight: number;
  measures: GoalMeasure[];
  approvedBy?: string;
  subsidiaryId: string;
}
```

### Review

```typescript
interface Review {
  id: string;
  employeeUserId: string;
  reviewerId: string;
  period: string;
  type: 'mid_year' | 'year_end' | 'probation' | 'project';
  status: 'draft' | 'in_progress' | 'submitted' | 'acknowledged';
  overallRating: number;
  goalAchievement: number;
  competencyRating: number;
  strengths: string[];
  improvements: string[];
  comments: string;
  employeeComments?: string;
  subsidiaryId: string;
}
```

### Competency

```typescript
interface Competency {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'leadership' | 'technical' | 'functional';
  levels: CompetencyLevel[];
  isActive: boolean;
  subsidiaryId: string;
}

interface CompetencyLevel {
  level: number;
  name: string;
  description: string;
  behaviors: string[];
}
```

## Rating Scale

| Rating | Description |
|--------|-------------|
| 5 | Exceptional - Significantly exceeds expectations |
| 4 | Exceeds - Consistently exceeds expectations |
| 3 | Meets - Fully meets expectations |
| 2 | Developing - Partially meets expectations |
| 1 | Below - Does not meet expectations |

## Integration Points

### HR Central
- Employee records
- Organizational structure

### CEO Strategy
- OKR linkage
- Performance metrics

### Financial
- Performance-based compensation
