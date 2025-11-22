import { prisma } from '../prisma';
import { AIChatService } from '../ai/chatService';
import { emailService } from '../email';
import { whatsAppService } from '../messaging';
import { createNotification } from '../notifications';

interface WorkflowStep {
  id: string;
  name: string;
  action: string;
  conditions?: Record<string, any>;
  delay?: number; // milliseconds
  retryCount?: number;
  maxRetries?: number;
}

interface Workflow {
  id: string;
  name: string;
  trigger: string;
  steps: WorkflowStep[];
  isActive: boolean;
  organizationId: string;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentStep: number;
  data: Record<string, any>;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export class WorkflowEngine {
  private workflows: Map<string, Workflow> = new Map();

  constructor() {
    this.initializeDefaultWorkflows();
  }

  // Initialize default workflows
  private initializeDefaultWorkflows() {
    // Order Processing Workflow
    this.registerWorkflow({
      id: 'order-processing',
      name: 'Order Processing',
      trigger: 'order.created',
      isActive: true,
      organizationId: 'default',
      steps: [
        {
          id: 'validate-order',
          name: 'Validate Order',
          action: 'validateOrder',
          conditions: { orderStatus: 'DRAFT' },
        },
        {
          id: 'check-inventory',
          name: 'Check Inventory',
          action: 'checkInventory',
        },
        {
          id: 'process-payment',
          name: 'Process Payment',
          action: 'processPayment',
          conditions: { paymentMethod: 'ONLINE' },
        },
        {
          id: 'update-order-status',
          name: 'Update Order Status',
          action: 'updateOrderStatus',
          conditions: { newStatus: 'CONFIRMED' },
        },
        {
          id: 'send-confirmation',
          name: 'Send Confirmation',
          action: 'sendOrderConfirmation',
          delay: 5000, // 5 seconds delay
        },
        {
          id: 'assign-courier',
          name: 'Assign Courier',
          action: 'assignCourier',
          conditions: { orderStatus: 'CONFIRMED' },
        },
      ],
    });

    // Inventory Management Workflow
    this.registerWorkflow({
      id: 'inventory-management',
      name: 'Inventory Management',
      trigger: 'inventory.low',
      isActive: true,
      organizationId: 'default',
      steps: [
        {
          id: 'check-reorder-point',
          name: 'Check Reorder Point',
          action: 'checkReorderPoint',
        },
        {
          id: 'create-purchase-order',
          name: 'Create Purchase Order',
          action: 'createPurchaseOrder',
          conditions: { needsReorder: true },
        },
        {
          id: 'notify-supplier',
          name: 'Notify Supplier',
          action: 'notifySupplier',
          delay: 10000, // 10 seconds delay
        },
        {
          id: 'update-inventory-status',
          name: 'Update Inventory Status',
          action: 'updateInventoryStatus',
        },
      ],
    });

    // Customer Engagement Workflow
    this.registerWorkflow({
      id: 'customer-engagement',
      name: 'Customer Engagement',
      trigger: 'customer.created',
      isActive: true,
      organizationId: 'default',
      steps: [
        {
          id: 'send-welcome',
          name: 'Send Welcome Message',
          action: 'sendWelcomeMessage',
          delay: 30000, // 30 seconds delay
        },
        {
          id: 'create-profile',
          name: 'Create Customer Profile',
          action: 'createCustomerProfile',
        },
        {
          id: 'assign-segment',
          name: 'Assign Customer Segment',
          action: 'assignCustomerSegment',
        },
        {
          id: 'schedule-followup',
          name: 'Schedule Follow-up',
          action: 'scheduleFollowUp',
          delay: 86400000, // 24 hours delay
        },
      ],
    });

    // Payment Processing Workflow
    this.registerWorkflow({
      id: 'payment-processing',
      name: 'Payment Processing',
      trigger: 'payment.received',
      isActive: true,
      organizationId: 'default',
      steps: [
        {
          id: 'validate-payment',
          name: 'Validate Payment',
          action: 'validatePayment',
        },
        {
          id: 'update-order-status',
          name: 'Update Order Status',
          action: 'updateOrderStatus',
          conditions: { newStatus: 'PAID' },
        },
        {
          id: 'send-receipt',
          name: 'Send Receipt',
          action: 'sendReceipt',
          delay: 5000,
        },
        {
          id: 'trigger-fulfillment',
          name: 'Trigger Fulfillment',
          action: 'triggerFulfillment',
        },
      ],
    });
  }

  // Register a new workflow
  registerWorkflow(workflow: Workflow) {
    this.workflows.set(workflow.id, workflow);
  }

  // Trigger a workflow
  async triggerWorkflow(trigger: string, data: Record<string, any>, organizationId: string): Promise<void> {
    const workflows = Array.from(this.workflows.values()).filter(
      w => w.trigger === trigger && w.isActive && w.organizationId === organizationId
    );

    for (const workflow of workflows) {
      await this.executeWorkflow(workflow, data);
    }
  }

  // Execute a workflow
  private async executeWorkflow(workflow: Workflow, data: Record<string, any>): Promise<void> {
    const execution: WorkflowExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workflowId: workflow.id,
      status: 'pending',
      currentStep: 0,
      data,
      startedAt: new Date(),
    };

    try {
      execution.status = 'running';
      
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        execution.currentStep = i;

        // Check conditions
        if (step.conditions && !this.evaluateConditions(step.conditions, execution.data)) {
          console.log(`Step ${step.name} conditions not met, skipping`);
          continue;
        }

        // Execute step
        await this.executeStep(step, execution.data);

        // Apply delay if specified
        if (step.delay) {
          await new Promise(resolve => setTimeout(resolve, step.delay));
        }
      }

      execution.status = 'completed';
      execution.completedAt = new Date();
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.completedAt = new Date();
      console.error(`Workflow ${workflow.name} failed:`, error);
    }

    // Save execution to database
    await this.saveWorkflowExecution(execution);
  }

  // Execute a single workflow step
  private async executeStep(step: WorkflowStep, data: Record<string, any>): Promise<void> {
    console.log(`Executing step: ${step.name}`);

    switch (step.action) {
      case 'validateOrder':
        await this.validateOrder(data);
        break;
      case 'checkInventory':
        await this.checkInventory(data);
        break;
      case 'processPayment':
        await this.processPayment(data);
        break;
      case 'updateOrderStatus':
        await this.updateOrderStatus(data);
        break;
      case 'sendOrderConfirmation':
        await this.sendOrderConfirmation(data);
        break;
      case 'assignCourier':
        await this.assignCourier(data);
        break;
      case 'checkReorderPoint':
        await this.checkReorderPoint(data);
        break;
      case 'createPurchaseOrder':
        await this.createPurchaseOrder(data);
        break;
      case 'notifySupplier':
        await this.notifySupplier(data);
        break;
      case 'updateInventoryStatus':
        await this.updateInventoryStatus(data);
        break;
      case 'sendWelcomeMessage':
        await this.sendWelcomeMessage(data);
        break;
      case 'createCustomerProfile':
        await this.createCustomerProfile(data);
        break;
      case 'assignCustomerSegment':
        await this.assignCustomerSegment(data);
        break;
      case 'scheduleFollowUp':
        await this.scheduleFollowUp(data);
        break;
      case 'validatePayment':
        await this.validatePayment(data);
        break;
      case 'sendReceipt':
        await this.sendReceipt(data);
        break;
      case 'triggerFulfillment':
        await this.triggerFulfillment(data);
        break;
      default:
        throw new Error(`Unknown action: ${step.action}`);
    }
  }

  // Evaluate conditions
  private evaluateConditions(conditions: Record<string, any>, data: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(conditions)) {
      if (data[key] !== value) {
        return false;
      }
    }
    return true;
  }

  // Order Processing Actions
  private async validateOrder(data: Record<string, any>): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: { customer: true, items: { include: { product: true } } },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Validate customer information
    if (!order.customer.email || !order.customer.phone) {
      throw new Error('Customer contact information incomplete');
    }

    // Validate order items
    if (order.items.length === 0) {
      throw new Error('Order has no items');
    }

    // Validate total amount
    const totalAmount = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    if (Math.abs(totalAmount - order.totalAmount) > 0.01) {
      throw new Error('Order total amount mismatch');
    }
  }

  private async checkInventory(data: Record<string, any>): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) return;

    for (const item of order.items) {
      if (item.product.stockQuantity < item.quantity) {
        throw new Error(`Insufficient stock for ${item.product.name}`);
      }
    }
  }

  private async processPayment(data: Record<string, any>): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
    });

    if (!order || order.paymentMethod !== 'ONLINE') {
      return;
    }

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Update payment status
    await prisma.order.update({
      where: { id: data.orderId },
      data: { paymentStatus: 'PAID' },
    });
  }

  private async updateOrderStatus(data: Record<string, any>): Promise<void> {
    await prisma.order.update({
      where: { id: data.orderId },
      data: { status: data.newStatus },
    });
  }

  private async sendOrderConfirmation(data: Record<string, any>): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: { 
        customer: true,
        items: {
          include: {
            product: true
          }
        }
      },
    });

    if (!order) return;

    // Send email confirmation only if customer has email
    if (order.customer.email) {
      await emailService.sendEmail({
        to: order.customer.email,
        subject: `Order Confirmation #${order.orderNumber}`,
        templateId: 'order-confirmation',
        templateData: { order },
      });
    }

    // Send WhatsApp confirmation only if customer has phone
    if (order.customer.phone) {
      await whatsAppService.sendTextMessage(
        order.customer.phone,
        `Your order #${order.orderNumber} has been confirmed! Total: $${order.totalAmount}`,
        order.organizationId
      );
    }
  }

  private async assignCourier(data: Record<string, any>): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: { customer: true },
    });

    if (!order) return;

    // Find available courier
    const courier = await prisma.courier.findFirst({
      where: { isActive: true },
    });

    if (courier) {
      // Create shipment record
      const shipment = await prisma.shipment.create({
        data: {
          orderId: order.id,
          courierId: courier.id,
          status: 'PENDING',
        },
      });
    }
  }

  // Inventory Management Actions
  private async checkReorderPoint(data: Record<string, any>): Promise<void> {
    const products = await prisma.product.findMany({
      where: { organizationId: data.organizationId },
    });

    for (const product of products) {
      if (product.stockQuantity <= product.lowStockThreshold) {
        await this.triggerWorkflow('inventory.low', {
          productId: product.id,
          currentStock: product.stockQuantity,
          threshold: product.lowStockThreshold,
        }, data.organizationId);
      }
    }
  }

  private async createPurchaseOrder(data: Record<string, any>): Promise<void> {
    // Create purchase order logic
    console.log('Creating purchase order for low stock items');
  }

  private async notifySupplier(data: Record<string, any>): Promise<void> {
    // Notify supplier logic
    console.log('Notifying supplier about low stock');
  }

  private async updateInventoryStatus(data: Record<string, any>): Promise<void> {
    // Update inventory status logic
    console.log('Updating inventory status');
  }

  // Customer Engagement Actions
  private async sendWelcomeMessage(data: Record<string, any>): Promise<void> {
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
    });

    if (!customer) return;

    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) return;

    // Send welcome email only if customer has email
    if (customer.email) {
      await emailService.sendEmail({
        to: customer.email,
        subject: 'Welcome to SmartStore AI!',
        templateId: 'welcome',
        templateData: { customer },
      });
    }

    // Send welcome WhatsApp message only if customer has phone
    if (customer.phone) {
      await whatsAppService.sendTextMessage(
        customer.phone,
        `Welcome to SmartStore AI! We're excited to have you as a customer.`,
        customer.organizationId || ''
      );
    }
  }

  private async createCustomerProfile(data: Record<string, any>): Promise<void> {
    // Create customer profile logic
    console.log('Creating customer profile');
  }

  private async assignCustomerSegment(data: Record<string, any>): Promise<void> {
    // Assign customer segment logic
    console.log('Assigning customer segment');
  }

  private async scheduleFollowUp(data: Record<string, any>): Promise<void> {
    // Schedule follow-up logic
    console.log('Scheduling follow-up');
  }

  // Payment Processing Actions
  private async validatePayment(data: Record<string, any>): Promise<void> {
    // Validate payment logic
    console.log('Validating payment');
  }

  private async sendReceipt(data: Record<string, any>): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: { customer: true },
    });

    if (!order) return;

    // Send receipt email only if customer has email
    if (order.customer.email) {
      await emailService.sendEmail({
        to: order.customer.email,
        subject: `Receipt for Order #${order.orderNumber}`,
        templateId: 'receipt',
        templateData: { order },
      });
    }
  }

  private async triggerFulfillment(data: Record<string, any>): Promise<void> {
    // Trigger fulfillment logic
    console.log('Triggering fulfillment');
  }

  // Save workflow execution to database
  private async saveWorkflowExecution(execution: WorkflowExecution): Promise<void> {
    // This would save to a workflow_executions table
    console.log('Saving workflow execution:', execution);
  }

  // Get workflow statistics
  async getWorkflowStats(organizationId: string): Promise<any> {
    // This would query workflow execution statistics
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
    };
  }
}

export const workflowEngine = new WorkflowEngine();