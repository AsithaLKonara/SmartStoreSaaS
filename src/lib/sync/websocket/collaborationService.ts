import { WebSocket } from 'ws';

export interface CollaborationUser {
  userId: string;
  userName: string;
  presence: 'online' | 'away' | 'offline';
  cursor?: { x: number; y: number };
  lastSeen: Date;
}

export interface CollaborationSession {
  sessionId: string;
  documentId: string;
  users: Map<string, CollaborationUser>;
  changes: Array<Record<string, unknown>>;
}

export class CollaborationService {
  private sessions: Map<string, CollaborationSession> = new Map();
  private userSessions: Map<string, Set<string>> = new Map(); // userId -> Set<sessionId>

  joinSession(
    sessionId: string,
    documentId: string,
    userId: string,
    userName: string,
    _ws: WebSocket
  ): CollaborationSession {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = {
        sessionId,
        documentId,
        users: new Map(),
        changes: [],
      };
      this.sessions.set(sessionId, session);
    }

    const user: CollaborationUser = {
      userId,
      userName,
      presence: 'online',
      lastSeen: new Date(),
    };

    session.users.set(userId, user);

    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(sessionId);

    // Broadcast user joined
    this.broadcastToSession(sessionId, {
      type: 'user_joined',
      userId,
      userName,
      timestamp: new Date(),
    }, userId);

    return session;
  }

  leaveSession(sessionId: string, userId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.users.delete(userId);
    this.userSessions.get(userId)?.delete(sessionId);

    // Broadcast user left
    this.broadcastToSession(sessionId, {
      type: 'user_left',
      userId,
      timestamp: new Date(),
    }, userId);

    // Clean up empty sessions
    if (session.users.size === 0) {
      this.sessions.delete(sessionId);
    }
  }

  updateCursor(
    sessionId: string,
    userId: string,
    cursor: { x: number; y: number }
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const user = session.users.get(userId);
    if (user) {
      user.cursor = cursor;
      user.lastSeen = new Date();
    }

    // Broadcast cursor update
    this.broadcastToSession(sessionId, {
      type: 'cursor_update',
      userId,
      cursor,
      timestamp: new Date(),
    }, userId);
  }

  applyChange(
    sessionId: string,
    userId: string,
    change: Record<string, unknown>
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // Add change to history
    session.changes.push({
      ...change,
      userId,
      timestamp: new Date(),
    });

    // Broadcast change
    this.broadcastToSession(sessionId, {
      type: 'change',
      change,
      userId,
      timestamp: new Date(),
    }, userId);
  }

  getPresence(sessionId: string): CollaborationUser[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    return Array.from(session.users.values());
  }

  updatePresence(userId: string, presence: 'online' | 'away' | 'offline'): void {
    const sessions = this.userSessions.get(userId);
    if (!sessions) {
      return;
    }

    sessions.forEach(sessionId => {
      const session = this.sessions.get(sessionId);
      if (session) {
        const user = session.users.get(userId);
        if (user) {
          user.presence = presence;
          user.lastSeen = new Date();

          // Broadcast presence update
          this.broadcastToSession(sessionId, {
            type: 'presence_update',
            userId,
            presence,
            timestamp: new Date(),
          }, userId);
        }
      }
    });
  }

  private broadcastToSession(
    sessionId: string,
    message: Record<string, unknown>,
    excludeUserId?: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // In a real implementation, this would broadcast to WebSocket connections
    // For now, this is a placeholder
    session.users.forEach((user, userId) => {
      if (userId !== excludeUserId) {
        // Send message to user's WebSocket connection
        // ws.send(JSON.stringify(message));
      }
    });
  }
}

