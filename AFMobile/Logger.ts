import appInsights from './AppInsights';

interface LogContext {
  userId?: string | number;
  conversationId?: string | number;
  messageId?: string | number;
  action?: string;
  screen?: string;
  error?: string;
  duration?: number;
  messageLength?: number;
  participantCount?: number;
  [key: string]: any;
}

class Logger {
  static info(message: string, context?: LogContext) {
    console.log(`ℹ️ ${message}`, context);
    
    appInsights.trackEvent({
      name: 'app_log_info',
      properties: {
        message,
        ...context,
        level: 'info',
        timestamp: new Date().toISOString()
      }
    });
  }

  static warn(message: string, context?: LogContext) {
    console.warn(`⚠️ ${message}`, context);
    
    appInsights.trackEvent({
      name: 'app_log_warn',
      properties: {
        message,
        ...context,
        level: 'warning',
        timestamp: new Date().toISOString()
      }
    });
  }

  static error(message: string, error?: Error, context?: LogContext) {
    console.error(`❌ ${message}`, error, context);
    
    appInsights.trackException({
      exception: error || new Error(message),
      properties: {
        message,
        ...context,
        level: 'error',
        timestamp: new Date().toISOString()
      }
    });
  }

  // Spesialiserte trackere for din chat-app
  static trackUser(action: string, context?: LogContext) {
    console.log(`👤 User action: ${action}`, context);
    
    appInsights.trackEvent({
      name: 'user_action',
      properties: {
        action,
        ...context,
        category: 'user',
        timestamp: new Date().toISOString()
      }
    });
  }

  static trackMessage(action: string, context?: LogContext) {
    console.log(`💬 Message: ${action}`, context);
    
    appInsights.trackEvent({
      name: 'message_action',
      properties: {
        action,
        ...context,
        category: 'message',
        timestamp: new Date().toISOString()
      }
    });
  }

  static trackConversation(action: string, context?: LogContext) {
    console.log(`💭 Conversation: ${action}`, context);
    
    appInsights.trackEvent({
      name: 'conversation_action',
      properties: {
        action,
        ...context,
        category: 'conversation',
        timestamp: new Date().toISOString()
      }
    });
  }

  static trackSignalR(action: string, context?: LogContext) {
    console.log(`📡 SignalR: ${action}`, context);
    
    appInsights.trackEvent({
      name: 'signalr_action',
      properties: {
        action,
        ...context,
        category: 'signalr',
        timestamp: new Date().toISOString()
      }
    });
  }

  static trackNavigation(screen: string, context?: LogContext) {
    console.log(`🧭 Navigation: ${screen}`, context);
    
    appInsights.trackPageView({
      name: screen,
      properties: {
        ...context,
        timestamp: new Date().toISOString()
      }
    });
  }

  static trackPerformance(action: string, duration: number, context?: LogContext) {
    console.log(`⚡ Performance: ${action} took ${duration}ms`, context);
    
    appInsights.trackMetric({
      name: `performance_${action}`,
      average: duration,
      properties: {
        ...context,
        timestamp: new Date().toISOString()
      }
    });
  }

  // For debugging - kun i development
  static debug(message: string, context?: LogContext) {
    if (__DEV__) {
      console.log(`🐛 DEBUG: ${message}`, context);
    }
  }
}

export default Logger;