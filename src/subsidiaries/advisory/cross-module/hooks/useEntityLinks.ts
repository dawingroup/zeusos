import { useState, useEffect, useCallback } from 'react';
import {
  EntityLink,
  EntityReference,
  EntityGraph,
  CreateLinkInput,
  LinkDirection,
  LinkSuggestion,
  LinkableEntityType
} from '../types/cross-module';
import { entityLinkerService } from '../services/entity-linker';

export function useEntityLinks(
  entityId: string,
  entityType: LinkableEntityType,
  direction: LinkDirection = 'both'
) {
  const [links, setLinks] = useState<EntityLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLinks = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedLinks = await entityLinkerService.getEntityLinks(
        entityId,
        entityType,
        direction
      );
      setLinks(fetchedLinks);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch links'));
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, direction]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const createEntityLink = useCallback(
    async (input: CreateLinkInput, userId: string) => {
      const newLink = await entityLinkerService.createLink(input, userId);
      setLinks(prev => [...prev, newLink]);
      return newLink;
    },
    []
  );

  const removeLink = useCallback(async (linkId: string) => {
    await entityLinkerService.deleteLink(linkId);
    setLinks(prev => prev.filter(l => l.id !== linkId));
  }, []);

  const updateLink = useCallback(
    async (linkId: string, updates: Partial<Pick<EntityLink, 'strength' | 'metadata' | 'linkType'>>) => {
      await entityLinkerService.updateLink(linkId, updates);
      setLinks(prev =>
        prev.map(l => (l.id === linkId ? { ...l, ...updates } : l))
      );
    },
    []
  );

  return {
    links,
    loading,
    error,
    refresh: fetchLinks,
    createEntityLink,
    removeLink,
    updateLink
  };
}

export function useEntityGraph(rootEntity: EntityReference, maxDepth: number = 2) {
  const [graph, setGraph] = useState<EntityGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchGraph = async () => {
      try {
        setLoading(true);
        const entityGraph = await entityLinkerService.buildEntityGraph(
          rootEntity,
          maxDepth
        );
        setGraph(entityGraph);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to build graph'));
      } finally {
        setLoading(false);
      }
    };

    fetchGraph();
  }, [rootEntity.id, rootEntity.type, rootEntity.module, maxDepth]);

  return { graph, loading, error };
}

export function useLinkSuggestions(entity: EntityReference) {
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        setLoading(true);
        const fetchedSuggestions = await entityLinkerService.getSuggestedLinks(entity);
        setSuggestions(fetchedSuggestions);
      } catch (err) {
        console.error('Failed to fetch suggestions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [entity.id, entity.type, entity.module]);

  return { suggestions, loading };
}
