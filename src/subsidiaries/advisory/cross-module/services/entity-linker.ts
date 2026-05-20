import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import {
  EntityLink,
  EntityReference,
  EntityGraph,
  EntityGraphNode,
  EntityGraphEdge,
  CreateLinkInput,
  LinkDirection,
  LinkSuggestion,
  ModuleType,
  LinkableEntityType
} from '../types/cross-module';

const ENTITY_LINKS_COLLECTION = 'entityLinks';

const MODULE_COLLECTIONS: Record<ModuleType, Record<string, string>> = {
  infrastructure: {
    project: 'projects',
    engagement: 'engagements',
    facility: 'facilities',
    ipc: 'ipcs',
    milestone: 'milestones',
    contractor: 'contractors'
  },
  investment: {
    deal: 'deals',
    portfolio: 'portfolios',
    fund: 'funds',
    investment: 'investments',
    investor: 'investors'
  },
  advisory: {
    mandate: 'mandates',
    proposal: 'proposals',
    client: 'clients',
    deliverable: 'deliverables'
  },
  matflow: {
    requisition: 'requisitions',
    purchase_order: 'purchaseOrders',
    supplier: 'suppliers',
    boq: 'boqs',
    delivery: 'deliveries',
    material: 'materials'
  }
};

export class EntityLinkerService {
  async createLink(input: CreateLinkInput, userId: string): Promise<EntityLink> {
    const linkId = doc(collection(db, ENTITY_LINKS_COLLECTION)).id;
    const now = Timestamp.now();

    const link: EntityLink = {
      id: linkId,
      sourceEntity: input.sourceEntity,
      targetEntity: input.targetEntity,
      linkType: input.linkType,
      strength: input.strength || 'medium',
      bidirectional: input.bidirectional ?? true,
      metadata: input.metadata || {},
      createdAt: now,
      createdBy: userId,
      updatedAt: now
    };

    await setDoc(doc(db, ENTITY_LINKS_COLLECTION, linkId), link);

    if (link.bidirectional) {
      const reverseLinkId = doc(collection(db, ENTITY_LINKS_COLLECTION)).id;
      const reverseLink: EntityLink = {
        ...link,
        id: reverseLinkId,
        sourceEntity: input.targetEntity,
        targetEntity: input.sourceEntity,
        metadata: { ...link.metadata, reverseLinkOf: linkId }
      };
      await setDoc(doc(db, ENTITY_LINKS_COLLECTION, reverseLinkId), reverseLink);
    }

    return link;
  }

  async getEntityLinks(
    entityId: string,
    entityType: LinkableEntityType,
    direction: LinkDirection = 'both'
  ): Promise<EntityLink[]> {
    const links: EntityLink[] = [];

    if (direction === 'outgoing' || direction === 'both') {
      const outgoingQuery = query(
        collection(db, ENTITY_LINKS_COLLECTION),
        where('sourceEntity.id', '==', entityId),
        where('sourceEntity.type', '==', entityType)
      );
      const outgoingSnap = await getDocs(outgoingQuery);
      outgoingSnap.forEach(docSnap => links.push(docSnap.data() as EntityLink));
    }

    if (direction === 'incoming' || direction === 'both') {
      const incomingQuery = query(
        collection(db, ENTITY_LINKS_COLLECTION),
        where('targetEntity.id', '==', entityId),
        where('targetEntity.type', '==', entityType)
      );
      const incomingSnap = await getDocs(incomingQuery);
      incomingSnap.forEach(docSnap => {
        if (!links.find(l => l.id === docSnap.id)) {
          links.push(docSnap.data() as EntityLink);
        }
      });
    }

    return links;
  }

  async buildEntityGraph(
    rootEntity: EntityReference,
    maxDepth: number = 2
  ): Promise<EntityGraph> {
    const nodes: EntityGraphNode[] = [];
    const edges: EntityGraphEdge[] = [];
    const visited = new Set<string>();

    const traverse = async (entity: EntityReference, depth: number) => {
      const entityKey = `${entity.module}:${entity.type}:${entity.id}`;
      if (visited.has(entityKey) || depth > maxDepth) return;
      visited.add(entityKey);

      const links = await this.getEntityLinks(entity.id, entity.type, 'outgoing');
      
      nodes.push({
        entity,
        depth,
        linkCount: links.length
      });

      for (const link of links) {
        edges.push({
          source: entity.id,
          target: link.targetEntity.id,
          linkType: link.linkType,
          strength: link.strength
        });

        if (depth < maxDepth) {
          await traverse(link.targetEntity, depth + 1);
        }
      }
    };

    await traverse(rootEntity, 0);

    return { nodes, edges, rootEntity, maxDepth };
  }

  async getEntityReference(
    entityId: string,
    entityType: LinkableEntityType,
    module: ModuleType
  ): Promise<EntityReference | null> {
    const collectionName = MODULE_COLLECTIONS[module]?.[entityType];
    if (!collectionName) return null;

    const docRef = doc(db, collectionName, entityId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    return {
      id: entityId,
      type: entityType,
      module,
      name: data.name || data.title || data.projectName || 'Unknown',
      referenceNumber: data.referenceNumber || data.projectNumber || data.code,
      metadata: { status: data.status, createdAt: data.createdAt }
    };
  }

  async getSuggestedLinks(entity: EntityReference): Promise<LinkSuggestion[]> {
    const suggestions: LinkSuggestion[] = [];

    switch (entity.module) {
      case 'infrastructure':
        if (entity.type === 'project') {
          const investmentsQuery = query(
            collection(db, 'investments'),
            where('status', '==', 'active'),
            limit(5)
          );
          const investmentSnap = await getDocs(investmentsQuery);
          investmentSnap.forEach(docSnap => {
            const data = docSnap.data();
            suggestions.push({
              targetEntity: {
                id: docSnap.id,
                type: 'investment',
                module: 'investment',
                name: data.name,
                referenceNumber: data.code
              },
              suggestedLinkType: 'funded_by',
              confidence: 0.7,
              reason: 'Active investment available for project funding'
            });
          });
        }
        break;

      case 'matflow':
        if (entity.type === 'boq') {
          const projectsQuery = query(
            collection(db, 'projects'),
            where('status', '==', 'active'),
            limit(5)
          );
          const projectSnap = await getDocs(projectsQuery);
          projectSnap.forEach(docSnap => {
            const data = docSnap.data();
            suggestions.push({
              targetEntity: {
                id: docSnap.id,
                type: 'project',
                module: 'infrastructure',
                name: data.name || data.projectName,
                referenceNumber: data.projectNumber
              },
              suggestedLinkType: 'belongs_to',
              confidence: 0.8,
              reason: 'Active project requiring materials'
            });
          });
        }
        break;

      case 'investment':
        if (entity.type === 'portfolio') {
          const dealsQuery = query(
            collection(db, 'deals'),
            where('status', '==', 'open'),
            limit(5)
          );
          const dealSnap = await getDocs(dealsQuery);
          dealSnap.forEach(docSnap => {
            const data = docSnap.data();
            suggestions.push({
              targetEntity: {
                id: docSnap.id,
                type: 'deal',
                module: 'investment',
                name: data.name,
                referenceNumber: data.dealNumber
              },
              suggestedLinkType: 'includes',
              confidence: 0.75,
              reason: 'Open deal available for portfolio inclusion'
            });
          });
        }
        break;
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  async deleteLink(linkId: string): Promise<void> {
    const linkRef = doc(db, ENTITY_LINKS_COLLECTION, linkId);
    const linkSnap = await getDoc(linkRef);
    
    if (!linkSnap.exists()) return;

    const link = linkSnap.data() as EntityLink;
    await deleteDoc(linkRef);

    if (link.bidirectional && link.metadata?.reverseLinkOf) {
      await deleteDoc(doc(db, ENTITY_LINKS_COLLECTION, link.metadata.reverseLinkOf as string));
    }
  }

  async bulkCreateLinks(inputs: CreateLinkInput[], userId: string): Promise<EntityLink[]> {
    const batch = writeBatch(db);
    const links: EntityLink[] = [];
    const now = Timestamp.now();

    for (const input of inputs) {
      const linkId = doc(collection(db, ENTITY_LINKS_COLLECTION)).id;
      const link: EntityLink = {
        id: linkId,
        sourceEntity: input.sourceEntity,
        targetEntity: input.targetEntity,
        linkType: input.linkType,
        strength: input.strength || 'medium',
        bidirectional: input.bidirectional ?? true,
        metadata: input.metadata || {},
        createdAt: now,
        createdBy: userId,
        updatedAt: now
      };

      batch.set(doc(db, ENTITY_LINKS_COLLECTION, linkId), link);
      links.push(link);
    }

    await batch.commit();
    return links;
  }

  async updateLink(
    linkId: string,
    updates: Partial<Pick<EntityLink, 'strength' | 'metadata' | 'linkType'>>
  ): Promise<void> {
    await updateDoc(doc(db, ENTITY_LINKS_COLLECTION, linkId), {
      ...updates,
      updatedAt: Timestamp.now()
    });
  }
}

export const entityLinkerService = new EntityLinkerService();
