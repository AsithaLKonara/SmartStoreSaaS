import { prisma } from '@/lib/prisma';

export interface WorkflowNode {
  id: string;
  type: 'TRIGGER' | 'ACTION' | 'CONDITION' | 'DELAY' | 'WEBHOOK' | 'EMAIL' | 'SMS';
  name: string;
  description: string;
  config: any;
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
  description: string;
  version: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  triggers: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED';
  currentNodeId: string;
  data: any;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
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
  data?: any;
  timestamp: Date;
  duration: number;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  definition: WorkflowDefinition;
  tags: string[];
  usageCount: number;
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
          version: definition.version,
          nodes: definition.nodes,
          connections: definition.connections,
          triggers: definition.triggers,
          isActive: definition.isActive,
        },
      });

      return {
        ...workflow,
        nodes: workflow.nodes as WorkflowNode[],
        connections: workflow.connections as WorkflowConnection[],
        triggers: workflow.triggers as string[],
      };
    } catch (error) {
      console.error('Error creating workflow:', error);
      throw new Error('Failed to create workflow');
    }
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowId: string, triggerData: any): Promise<WorkflowExecution> {
    try {
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow || !workflow.isActive) {
        throw new Error('Workflow not found or inactive');
      }

      const definition: WorkflowDefinition = {
        ...workflow,
        nodes: workflow.nodes as WorkflowNode[],
        connections: workflow.connections as WorkflowConnection[],
        triggers: workflow.triggers as string[],
      };

      // Create execution record
      const execution = await prisma.workflowExecution.create({
        data: {
          workflowId,
          status: 'RUNNING',
          currentNodeId: definition.nodes[0]?.id || '',
          data: triggerData,
          logs: [],
        },
      });

      // Start execution
      this.runWorkflowExecution(execution.id, definition, triggerData);

      return {
        ...execution,
        logs: execution.logs as WorkflowLog[],
      };
    } catch (error) {
      console.error('Error executing workflow:', error);
      throw new Error('Failed to execute workflow');
    }
  }

  /**
   * Run workflow execution asynchronously
   */
  private async runWorkflowExecution(executionId: string, definition: WorkflowDefinition, data: any): Promise<void> {
    try {
      const execution = await prisma.workflowExecution.findUnique({
        where: { id: executionId },
      });

      if (!execution) return;

      let currentNodeId = execution.currentNodeId;
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
              logs: {
                push: log,
              },
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
              status: 'FAILED',
              error: log.message,
              logs: {
                push: log,
              },
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
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
      }

    } catch (error) {
      console.error('Error running workflow execution:', error);
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Execute a single workflow node
   */
  private async executeNode(node: WorkflowNode, data: any): Promise<any> {
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

  private async executeTrigger(node: WorkflowNode, data: any): Promise<any> {
    // Trigger nodes typically just pass data through
    return data;
  }

  private async executeAction(node: WorkflowNode, data: any): Promise<any> {
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

  private async executeCondition(node: WorkflowNode, data: any): Promise<any> {
    const condition = node.config.condition;
    
    // Evaluate condition using a simple expression evaluator
    const result = this.evaluateCondition(condition, data);
    
    return { conditionResult: result };
  }

  private async executeDelay(node: WorkflowNode, data: any): Promise<any> {
    const delayMs = node.config.delayMs || 1000;
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return data;
  }

  private async executeWebhook(node: WorkflowNode, data: any): Promise<any> {
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

  private async executeEmail(node: WorkflowNode, data: any): Promise<any> {
    const template = node.config.template;
    const recipients = node.config.recipients;
    const subject = node.config.subject;
    
    // Send email using your email service
    // This is a placeholder implementation
    console.log(`Sending email to ${recipients}: ${subject}`);
    
    return { emailSent: true, recipients };
  }

  private async executeSMS(node: WorkflowNode, data: any): Promise<any> {
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
  private async createOrder(data: any): Promise<any> {
    const order = await prisma.order.create({
      data: {
        customerId: data.customerId,
        status: 'PENDING',
        total: data.total,
        items: data.items,
        organizationId: data.organizationId,
      },
    });
    
    return { orderId: order.id, order };
  }

  private async updateInventory(data: any): Promise<any> {
    const { productId, quantity, operation } = data;
    
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const newStock = operation === 'ADD' 
      ? product.stock + quantity
      : product.stock - quantity;

    await prisma.product.update({
      where: { id: productId },
      data: { stock: newStock },
    });

    return { productId, newStock };
  }

  private async sendNotification(data: any): Promise<any> {
    const { userId, message, type } = data;
    
    // Send notification using your notification service
    console.log(`Sending ${type} notification to user ${userId}: ${message}`);
    
    return { notificationSent: true, userId, type };
  }

  private async assignTask(data: any): Promise<any> {
    const { userId, task, priority } = data;
    
    // Assign task to user
    console.log(`Assigning task to user ${userId}: ${task} (${priority})`);
    
    return { taskAssigned: true, userId, task };
  }

  private async updateCustomer(data: any): Promise<any> {
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
  private evaluateCondition(condition: string, data: any): boolean {
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
          description: template.description,
          category: template.category,
          definition: template.definition,
          tags: template.tags,
        },
      });

      return {
        ...workflowTemplate,
        definition: workflowTemplate.definition as WorkflowDefinition,
        tags: workflowTemplate.tags as string[],
      };
    } catch (error) {
      console.error('Error creating workflow template:', error);
      throw new Error('Failed to create workflow template');
    }
  }

  async getWorkflowTemplates(category?: string): Promise<WorkflowTemplate[]> {
    try {
      const where = category ? { category } : {};
      
      const templates = await prisma.workflowTemplate.findMany({
        where,
        orderBy: { usageCount: 'desc' },
      });

      return templates.map(template => ({
        ...template,
        definition: template.definition as WorkflowDefinition,
        tags: template.tags as string[],
      }));
    } catch (error) {
      console.error('Error getting workflow templates:', error);
      return [];
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
      const where: any = {};
      if (workflowId) where.workflowId = workflowId;
      if (status) where.status = status;

      const executions = await prisma.workflowExecution.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      });

      return executions.map(execution => ({
        ...execution,
        logs: execution.logs as WorkflowLog[],
      }));
    } catch (error) {
      console.error('Error getting workflow executions:', error);
      return [];
    }
  }

  async getWorkflowAnalytics(workflowId: string, timeRange: { start: Date; end: Date }): Promise<any> {
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