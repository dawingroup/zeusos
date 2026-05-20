/**
 * Google Chat Incident Space Manager
 * Allows AI agents to programmatically create and manage incident spaces
 * for internal team coordination
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const gchatClient = require('./gchatClient');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const COLLECTIONS = {
  SPACES: 'gchatSpaces',
  BUSINESS_EVENTS: 'businessEvents',
};

/**
 * Build an incident card (Card v2 format)
 */
function buildIncidentCard(incidentData) {
  return [
    {
      cardId: `incident-${incidentData.id || 'new'}`,
      card: {
        header: {
          title: incidentData.title,
          subtitle: `Severity: ${incidentData.severity || 'medium'} | ${incidentData.sourceModule || 'System'}`,
          imageUrl: 'https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/warning/default/48px.svg',
          imageType: 'CIRCLE',
        },
        sections: [
          {
            header: 'Incident Details',
            widgets: [
              {
                decoratedText: {
                  topLabel: 'Description',
                  text: incidentData.description || 'No description provided',
                },
              },
              ...(incidentData.entityName
                ? [
                    {
                      decoratedText: {
                        topLabel: 'Related Entity',
                        text: incidentData.entityName,
                        startIcon: { knownIcon: 'BOOKMARK' },
                      },
                    },
                  ]
                : []),
              ...(incidentData.reportedBy
                ? [
                    {
                      decoratedText: {
                        topLabel: 'Reported By',
                        text: incidentData.reportedBy,
                        startIcon: { knownIcon: 'PERSON' },
                      },
                    },
                  ]
                : []),
              {
                decoratedText: {
                  topLabel: 'Created',
                  text: new Date().toLocaleString('en-UG', { timeZone: 'Africa/Kampala' }),
                  startIcon: { knownIcon: 'CLOCK' },
                },
              },
            ],
          },
          {
            widgets: [
              {
                buttonList: {
                  buttons: [
                    {
                      text: 'Acknowledge',
                      onClick: {
                        action: {
                          function: 'acknowledge_incident',
                          parameters: [
                            { key: 'incidentId', value: incidentData.id || '' },
                          ],
                        },
                      },
                    },
                    {
                      text: 'Resolve',
                      onClick: {
                        action: {
                          function: 'resolve_incident',
                          parameters: [
                            { key: 'incidentId', value: incidentData.id || '' },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    },
  ];
}

/**
 * Create an incident space in Google Chat
 * Callable function - can be invoked by AI agents or frontend
 */
const createIncidentSpace = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const {
      title,
      description,
      severity = 'medium',
      assignees = [],
      sourceModule = 'system',
      entityType,
      entityId,
      entityName,
      reportedBy,
    } = request.data;

    if (!title) {
      throw new HttpsError('invalid-argument', 'Incident title is required');
    }

    try {
      // 1. Create a Google Chat Space
      const spaceName = `Incident: ${title}`;
      const space = await gchatClient.createSpace(spaceName, 'SPACE', description || title);

      logger.info('Incident space created', { spaceName: space.name, title });

      // 2. Add relevant team members
      const addedMembers = [];
      for (const email of assignees) {
        try {
          await gchatClient.createMember(space.name, email);
          addedMembers.push(email);
        } catch (err) {
          logger.warn('Failed to add member to incident space', {
            email,
            error: err.message,
          });
        }
      }

      // 3. Send initial card with incident details
      const incidentData = {
        id: space.name.replace('spaces/', ''),
        title,
        description,
        severity,
        sourceModule,
        entityName,
        reportedBy: reportedBy || request.auth.token.email || 'System',
      };

      const card = buildIncidentCard(incidentData);
      await gchatClient.sendCardMessage(space.name, card);

      // 4. Store in Firestore for frontend sync
      const spaceId = space.name.replace('spaces/', '');
      await db.collection(COLLECTIONS.SPACES).doc(spaceId).set({
        spaceName: space.name,
        displayName: spaceName,
        spaceType: 'SPACE',
        description: description || '',
        incidentId: entityId || null,
        projectId: null,
        type: 'incident',
        members: addedMembers,
        memberCount: addedMembers.length,
        status: 'active',
        severity,
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        lastMessageText: `Incident created: ${title}`,
        unreadCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: request.auth.uid,
      });

      // 5. Emit business event for intelligence layer
      const eventRef = db.collection(COLLECTIONS.BUSINESS_EVENTS).doc();
      await eventRef.set({
        id: eventRef.id,
        eventType: 'incident_space_created',
        category: 'internal_communication',
        severity,
        sourceModule: 'gchat_bridge',
        subsidiary: 'finishes',
        entityType: entityType || 'incident',
        entityId: entityId || spaceId,
        entityName: entityName || title,
        title: `Incident space created: ${title}`,
        description: `A new incident space has been created with ${addedMembers.length} member(s)`,
        previousState: null,
        currentState: {
          spaceCreated: true,
          spaceName: space.name,
          members: addedMembers,
        },
        triggeredBy: request.auth.uid,
        triggeredByName: request.auth.token.name || request.auth.token.email || 'System',
        triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        metadata: {
          spaceName: space.name,
          severity,
          assigneeCount: addedMembers.length,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        spaceName: space.name,
        spaceId,
        membersAdded: addedMembers,
      };
    } catch (err) {
      logger.error('Failed to create incident space', { error: err.message, stack: err.stack });
      throw new HttpsError('internal', 'Failed to create incident space', err.message);
    }
  }
);

/**
 * Resolve an incident space - archive and notify
 */
const resolveIncidentSpace = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { spaceId, resolution } = request.data;

    if (!spaceId) {
      throw new HttpsError('invalid-argument', 'Space ID is required');
    }

    try {
      const spaceDoc = await db.collection(COLLECTIONS.SPACES).doc(spaceId).get();
      if (!spaceDoc.exists) {
        throw new HttpsError('not-found', 'Space not found');
      }

      const spaceData = spaceDoc.data();

      // Send resolution message
      const resolverName = request.auth.token.name || request.auth.token.email || 'System';
      await gchatClient.sendMessage(
        spaceData.spaceName,
        `*Incident Resolved* by ${resolverName}\n\n${resolution || 'No resolution notes provided.'}`
      );

      // Update Firestore
      await db.collection(COLLECTIONS.SPACES).doc(spaceId).update({
        status: 'archived',
        resolution: resolution || '',
        resolvedBy: request.auth.uid,
        resolvedByName: resolverName,
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, spaceId };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error('Failed to resolve incident space', { error: err.message });
      throw new HttpsError('internal', 'Failed to resolve incident space');
    }
  }
);

module.exports = {
  createIncidentSpace,
  resolveIncidentSpace,
  buildIncidentCard,
};
