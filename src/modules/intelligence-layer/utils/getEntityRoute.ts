/**
 * Maps task source entity fields to navigation routes.
 */

interface EntityRouteParams {
  entityType?: string;
  entityId?: string;
  projectId?: string;
  sourceModule?: string;
}

/**
 * Returns a navigation route for the task's source entity.
 * Returns null if the combination is unrecognized or missing required IDs.
 */
export function getEntityRoute(params: EntityRouteParams): string | null {
  const { entityType, entityId, projectId, sourceModule } = params;
  if (!entityType || !entityId) return null;

  switch (entityType) {
    case 'design-item':
      if (!projectId) return null;
      return `/design/project/${projectId}/item/${entityId}`;

    case 'project':
      if (sourceModule === 'delivery') {
        return `/advisory/delivery/projects/${entityId}`;
      }
      return `/design/project/${entityId}`;

    case 'employee':
      return `/hr/employees/${entityId}`;

    default:
      return null;
  }
}

/**
 * Returns a route to the parent project, independent of entity type.
 * Useful for a separate "View Project" link alongside "View Entity".
 */
export function getProjectRoute(params: {
  projectId?: string;
  sourceModule?: string;
}): string | null {
  const { projectId, sourceModule } = params;
  if (!projectId) return null;

  if (sourceModule === 'delivery') {
    return `/advisory/delivery/projects/${projectId}`;
  }
  return `/design/project/${projectId}`;
}
