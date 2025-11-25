import { prisma } from '@/lib/prisma';

export interface WorkflowNode {
  id: string;
  type: 'TRIGGER' | 'ACTION' | 'CONDITION' | 'DELAY' | 'WEBHOOK' | 'EMAIL' | 'SMS';
  name: string;
  description: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
  connections: string[];
}

export interface WorkflowConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  condition?: string;
  label?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string | null;
  version: number;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  triggers: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
  config?: Record<string, unknown>;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: string; // Changed from enum to string to match Prisma schema
  currentNodeId?: string | null;
  data?: Record<string, unknown>;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
  logs: WorkflowLog[];
}

export interface WorkflowLog {
  id: string;
  executionId: string;
  nodeId: string;
  nodeName: string;
  action: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  message: string;
  data?: Record<string, unknown>;
  timestamp: Date;
  duration: number;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  definition?: Record<string, unknown>;
  tags?: Array<string>;
  usageCount: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  config?: Record<string, unknown>;
}

export class AdvancedWorkflowEngine {
  /**
   * Create a new workflow definition
   */
  async createWorkflow(definition: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkflowDefinition> {
    try {
      const workflow = await prisma.workflow.create({
        data: {
          name: definition.name,
          description: definition.description,
          type: 'custom', // Add required type field
          version: definition.version,
          nodes: definition.nodes as Array<Record<string, unknown>>, // Store as JSON
          connections: definition.connections as Array<Record<string, unknown>>,
          triggers: definition.triggers,
          isActive: definition.isActive,
          organizationId: definition.organizationId,
        },
      });

      return {
        ...workflow,
        nodes: (workflow.nodes as Array<Record<string, unknown>>) || [],
        connections: (workflow.connections as Array<Record<string, unknown>>) || [],
        triggers: (workflow.triggers as Array<string>) || [],
        version: workflow.version || 1,
        organizationId: workflow.organizationId,
        config: workflow.config,
      };
    } catch (error) {
      console.error('Error creating workflow:', error);
      throw new Error('Failed to create workflow');
    }
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: string, triggerData: Record<string, unknown>): Promise<WorkflowExecution> {
    try {
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow || !workflow.isActive) {
        throw new Error('Workflow not found or inactive');
      }

      const definition: WorkflowDefinition = {
        ...workflow,
        nodes: (workflow.nodes as Array<Record<string, unknown>>) || [],
        connections: (workflow.connections as Array<Record<string, unknown>>) || [],
        triggers: (workflow.triggers as Array<string>) || [],
        version: workflow.version || 1,
        organizationId: workflow.organizationId,
        config: workflow.config,
      };

      // Create execution record
      const execution = await prisma.workflowExecution.create({
        data: {
          workflowId,
          status: 'RUNNING',
          currentNodeId: definition.nodes[0]?.id || '',
          data: triggerData,
        },
      });

      // Start execution
      this.runWorkflowExecution(execution.id, definition, triggerData);

      return {
        id: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
        currentNodeId: execution.currentNodeId,
        data: execution.data,
        input: execution.input,
        output: execution.output,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt || undefined, // Convert null to undefined
        logs: []
      };
    } catch (error) {
      console.error('Error executing workflow:', error);
      throw new Error('Failed to execute workflow');
    }
  }

  /**
   * Run workflow execution asynchronously
   */
  private async runWorkflowExecution(executionId: string, definition: WorkflowDefinition, data: Record<string, unknown>): Promise<void> {
    try {
      // Update execution status to running
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'running', // Changed from 'RUNNING' to 'running' to match Prisma schema
          data: data,
        },
      });

      let currentNodeId = definition.nodes[0]?.id; // Start with first node
      let currentData = data;

      while (currentNodeId) {
        const node = definition.nodes.find(n => n.id === currentNodeId);
        if (!node) break;

        const startTime = Date.now();
        let log: WorkflowLog;

        try {
          // Execute node
          const result = await this.executeNode(node, currentData);
          
          log = {
            id: crypto.randomUUID(),
            executionId,
            nodeId: node.id,
            nodeName: node.name,
            action: `Executed ${node.type}`,
            status: 'SUCCESS',
            message: `Node ${node.name} executed successfully`,
            data: result,
            timestamp: new Date(),
            duration: Date.now() - startTime,
          };

          currentData = { ...currentData, ...result };

          // Find next node
          const connection = definition.connections.find(c => c.fromNodeId === node.id);
          currentNodeId = connection?.toNodeId || '';

          // Update execution
          await prisma.workflowExecution.update({
            where: { id: executionId },
            data: {
              currentNodeId,
              data: currentData,
            },
          });

          // Create log entry separately since logs is a relation
          await prisma.workflowLog.create({
            data: {
              executionId,
              level: 'info',
              message: log.message,
              data: log.data,
              timestamp: log.timestamp,
            },
          });

        } catch (error) {
          log = {
            id: crypto.randomUUID(),
            executionId,
            nodeId: node.id,
            nodeName: node.name,
            action: `Failed to execute ${node.type}`,
            status: 'FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
            duration: Date.now() - startTime,
          };

          // Update execution with error
          await prisma.workflowExecution.update({
            where: { id: executionId },
            data: {
              status: 'failed', // Changed from 'FAILED' to 'failed' to match Prisma schema
            },
          });

          // Create error log entry
          await prisma.workflowLog.create({
            data: {
              executionId,
              level: 'error',
              message: log.message,
              data: log.data,
              timestamp: log.timestamp,
            },
          });

          break;
        }
      }

      // Mark execution as completed
      if (currentNodeId === '') {
        await prisma.workflowExecution.update({
          where: { id: executionId },
          data: {
            status: 'completed', // Changed from 'COMPLETED' to 'completed' to match Prisma schema
            completedAt: new Date(),
          },
        });
      }

    } catch (error) {
      console.error('Error running workflow execution:', error);
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'failed', // Changed from 'FAILED' to 'failed' to match Prisma schema
          // Removed error field as it doesn't exist in Prisma schema
        },
      });
    }
  }

  /**
   * Execute a single workflow node
   */
  private async executeNode(node: WorkflowNode, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    switch (node.type) {
      case 'TRIGGER':
        return this.executeTrigger(node, data);
      case 'ACTION':
        return this.executeAction(node, data);
      case 'CONDITION':
        return this.executeCondition(node, data);
      case 'DELAY':
        return this.executeDelay(node, data);
      case 'WEBHOOK':
        return this.executeWebhook(node, data);
      case 'EMAIL':
        return this.executeEmail(node, data);
      case 'SMS':
        return this.executeSMS(node, data);
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  private async executeTrigger(node: WorkflowNode, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Trigger nodes typically just pass data through
    return data;
  }

  private async executeAction(node: WorkflowNode, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const action = node.config.action;
    
    switch (action) {
      case 'CREATE_ORDER':
        return await this.createOrder(data);
      case 'UPDATE_INVENTORY':
        return await this.updateInventory(data);
      case 'SEND_NOTIFICATION':
        return await this.sendNotification(data);
      case 'ASSIGN_TASK':
        return await this.assignTask(data);
      case 'UPDATE_CUSTOMER':
        return await this.updateCustomer(data);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private async executeCondition(node: WorkflowNode, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const condition = node.config.condition;
    
    // Evaluate condition using a simple expression evaluator
    const result = this.evaluateCondition(condition, data);
    
    return { conditionResult: result };
  }

  private async executeDelay(node: WorkflowNode, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const delayMs = node.config.delayMs || 1000;
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return data;
  }

  private async executeWebhook(node: WorkflowNode, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const url = node.config.url;
    const method = node.config.method || 'POST';
    const headers = node.config.headers || {};
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: method !== 'GET' ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`);
    }

    return await response.json();
  }

  private async executeEmail(node: WorkflowNode, _data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const _template = node.config.template;
    const recipients = node.config.recipients;
    const subject = node.config.subject;
    
    // Send email using your email service
    // This is a placeholder implementation
    console.log(`Sending email to ${recipients}: ${subject}`);
    
    return { emailSent: true, recipients };
  }

  private async executeSMS(node: WorkflowNode, _data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const message = node.config.message;
    const recipients = node.config.recipients;
    
    // Send SMS using your SMS service
    // This is a placeholder implementation
    console.log(`Sending SMS to ${recipients}: ${message}`);
    
    return { smsSent: true, recipients };
  }

  /**
   * Business logic implementations
   */
  private async createOrder(data: { customerId: string; totalAmount: number; subtotal?: number; tax?: number; shipping?: number; discount?: number; organizationId: string; createdById?: string }): Promise<Record<string, unknown>> {
    const order = await prisma.order.create({
      data: {
        customerId: data.customerId,
        status: 'DRAFT',
        totalAmount: data.totalAmount,
        subtotal: data.subtotal || data.totalAmount,
        tax: data.tax || 0,
        shipping: data.shipping || 0,
        discount: data.discount || 0,
        currency: 'USD',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        organizationId: data.organizationId,
        orderNumber: `ORD-${Date.now()}`,
        createdById: data.createdById || process.env.DEFAULT_USER_ID || 'default',
      },
    });
    
    return { orderId: order.id, order };
  }

  private async updateInventory(data: { productId: string; quantity: number; operation: 'ADD' | 'SUBTRACT' }): Promise<Record<string, unknown>> {
    const { productId, quantity, operation } = data;
    
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const newStock = operation === 'ADD' 
      ? product.stockQuantity + quantity
      : product.stockQuantity - quantity;

    await prisma.product.update({
      where: { id: productId },
      data: { stockQuantity: newStock },
    });

    return { productId, newStock };
  }

  private async sendNotification(data: { userId: string; message: string; type: string }): Promise<Record<string, unknown>> {
    const { userId, message, type } = data;
    
    // Send notification using your notification service
    console.log(`Sending ${type} notification to user ${userId}: ${message}`);
    
    return { notificationSent: true, userId, type };
  }

  private async assignTask(data: { userId: string; task: string; priority: string }): Promise<Record<string, unknown>> {
    const { userId, task, priority } = data;
    
    // Assign task to user
    console.log(`Assigning task to user ${userId}: ${task} (${priority})`);
    
    return { taskAssigned: true, userId, task };
  }

  private async updateCustomer(data: { customerId: string; updates: Record<string, unknown> }): Promise<Record<string, unknown>> {
    const { customerId, updates } = data;
    
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: updates,
    });

    return { customerId, customer };
  }

  /**
   * Condition evaluation
   */
  private evaluateCondition(condition: string, data: Record<string, unknown>): boolean {
    // Simple condition evaluator
    // In production, use a proper expression evaluator library
    try {
      // Replace variables with actual values
      let evaluatedCondition = condition;
      
      // Replace common patterns
      evaluatedCondition = evaluatedCondition.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key] !== undefined ? JSON.stringify(data[key]) : 'undefined';
      });

      // Evaluate the condition
      return eval(evaluatedCondition);
    } catch (error) {
      console.error('Error evaluating condition:', error);
      return false;
    }
  }

  /**
   * Workflow templates
   */
  async createWorkflowTemplate(template: Omit<WorkflowTemplate, 'id' | 'usageCount'>): Promise<WorkflowTemplate> {
    try {
      const workflowTemplate = await prisma.workflowTemplate.create({
        data: {
          name: template.name,
          description: template.description || null, // Handle null case
          category: template.category || null,
          definition: template.definition || null,
          tags: template.tags || null,
          isPublic: template.isPublic || false,
          config: template.config || null,
        },
      });

      return {
        id: workflowTemplate.id,
        name: workflowTemplate.name,
        description: workflowTemplate.description || undefined, // Convert null to undefined for interface
        category: workflowTemplate.category || undefined,
        definition: workflowTemplate.definition,
        tags: workflowTemplate.tags,
        usageCount: workflowTemplate.usageCount,
        isPublic: workflowTemplate.isPublic,
        createdAt: workflowTemplate.createdAt,
        updatedAt: workflowTemplate.updatedAt,
        config: workflowTemplate.config,
      };
    } catch (error) {
      console.error('Error creating workflow template:', error);
      throw error;
    }
  }

  async getWorkflowTemplates(category?: string): Promise<WorkflowTemplate[]> {
    try {
      const where = category ? { category } : {};
      
      const templates = await prisma.workflowTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return templates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description || undefined, // Convert null to undefined for interface
        category: template.category || undefined,
        definition: template.definition,
        tags: template.tags,
        usageCount: template.usageCount,
        isPublic: template.isPublic,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
        config: template.config,
      }));
    } catch (error) {
      console.error('Error getting workflow templates:', error);
      throw error;
    }
  }

  /**
   * Workflow monitoring and analytics
   */
  async getWorkflowExecutions(
    workflowId?: string,
    status?: string,
    page: number = 1,
    limit: number = 50
  ): Promise<WorkflowExecution[]> {
    try {
      const where: Record<string, unknown> = {};
      if (workflowId) where.workflowId = workflowId;
      if (status) where.status = status;

      const executions = await prisma.workflowExecution.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: { logs: true },
      });

      return executions.map((execution) => ({
        id: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
        currentNodeId: execution.currentNodeId,
        data: execution.data,
        input: execution.input,
        output: execution.output,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        logs: execution.logs || [], // Initialize logs array
      }));
    } catch (error) {
      console.error('Error getting workflow executions:', error);
      throw error;
    }
  }

  async getWorkflowAnalytics(workflowId: string, timeRange: { start: Date; end: Date }): Promise<{ totalExecutions: number; successfulExecutions: number; failedExecutions: number; successRate: number; averageDuration: number; executionsByStatus: Record<string, number> }> {
    try {
      const executions = await prisma.workflowExecution.findMany({
        where: {
          workflowId,
          startedAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
      });

      const totalExecutions = executions.length;
      const successfulExecutions = executions.filter(e => e.status === 'COMPLETED').length;
      const failedExecutions = executions.filter(e => e.status === 'FAILED').length;
      const averageDuration = executions
        .filter(e => e.completedAt)
        .reduce((acc, e) => acc + (e.completedAt!.getTime() - e.startedAt.getTime()), 0) / successfulExecutions;

      return {
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
        averageDuration: averageDuration || 0,
        executionsByStatus: {
          RUNNING: executions.filter(e => e.status === 'RUNNING').length,
          COMPLETED: successfulExecutions,
          FAILED: failedExecutions,
          PAUSED: executions.filter(e => e.status === 'PAUSED').length,
        },
      };
    } catch (error) {
      console.error('Error getting workflow analytics:', error);
      return {};
    }
  }
}

export const advancedWorkflowEngine = new AdvancedWorkflowEngine(); 