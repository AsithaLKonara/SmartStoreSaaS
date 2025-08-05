import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdvancedWorkflowEngine } from '@/lib/workflows/advancedWorkflowEngine';

const workflowEngine = new AdvancedWorkflowEngine();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const workflowId = searchParams.get('workflowId');
    const templateId = searchParams.get('templateId');

    switch (action) {
      case 'templates':
        const templates = await workflowEngine.getWorkflowTemplates();
        return NextResponse.json({ templates });

      case 'executions':
        const executions = await workflowEngine.getWorkflowExecutions();
        return NextResponse.json({ executions });

      case 'analytics':
        const analytics = await workflowEngine.getWorkflowAnalytics();
        return NextResponse.json({ analytics });

      case 'workflow':
        if (!workflowId) {
          return NextResponse.json({ error: 'Workflow ID required' }, { status: 400 });
        }
        const workflow = await prisma.workflow.findUnique({
          where: { id: workflowId },
          include: { nodes: true, connections: true }
        });
        return NextResponse.json({ workflow });

      case 'execution':
        if (!workflowId) {
          return NextResponse.json({ error: 'Workflow ID required' }, { status: 400 });
        }
        const execution = await prisma.workflowExecution.findFirst({
          where: { workflowId },
          include: { logs: true },
          orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ execution });

      default:
        const workflows = await prisma.workflow.findMany({
          include: { 
            nodes: true, 
            connections: true,
            executions: {
              take: 5,
              orderBy: { createdAt: 'desc' }
            }
          }
        });
        return NextResponse.json({ workflows });
    }
  } catch (error) {
    console.error('Workflow API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create-workflow':
        const workflow = await workflowEngine.createWorkflow(data);
        return NextResponse.json({ workflow });

      case 'execute-workflow':
        const execution = await workflowEngine.executeWorkflow(data.workflowId, data.input);
        return NextResponse.json({ execution });

      case 'create-template':
        const template = await workflowEngine.createWorkflowTemplate(data);
        return NextResponse.json({ template });

      case 'trigger-workflow':
        const triggerResult = await workflowEngine.executeWorkflow(data.workflowId, data.triggerData);
        return NextResponse.json({ result: triggerResult });

      case 'update-workflow':
        const updatedWorkflow = await prisma.workflow.update({
          where: { id: data.workflowId },
          data: {
            name: data.name,
            description: data.description,
            isActive: data.isActive,
            nodes: {
              deleteMany: {},
              create: data.nodes
            },
            connections: {
              deleteMany: {},
              create: data.connections
            }
          },
          include: { nodes: true, connections: true }
        });
        return NextResponse.json({ workflow: updatedWorkflow });

      case 'delete-workflow':
        await prisma.workflow.delete({
          where: { id: data.workflowId }
        });
        return NextResponse.json({ success: true });

      case 'pause-workflow':
        await prisma.workflow.update({
          where: { id: data.workflowId },
          data: { isActive: false }
        });
        return NextResponse.json({ success: true });

      case 'resume-workflow':
        await prisma.workflow.update({
          where: { id: data.workflowId },
          data: { isActive: true }
        });
        return NextResponse.json({ success: true });

      case 'clone-workflow':
        const originalWorkflow = await prisma.workflow.findUnique({
          where: { id: data.workflowId },
          include: { nodes: true, connections: true }
        });
        
        if (!originalWorkflow) {
          return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }

        const clonedWorkflow = await prisma.workflow.create({
          data: {
            name: `${originalWorkflow.name} (Copy)`,
            description: originalWorkflow.description,
            type: originalWorkflow.type,
            isActive: false,
            organizationId: originalWorkflow.organizationId,
            nodes: {
              create: originalWorkflow.nodes.map(node => ({
                type: node.type,
                name: node.name,
                config: node.config,
                position: node.position
              }))
            },
            connections: {
              create: originalWorkflow.connections.map(conn => ({
                sourceNodeId: conn.sourceNodeId,
                targetNodeId: conn.targetNodeId,
                condition: conn.condition
              }))
            }
          },
          include: { nodes: true, connections: true }
        });
        return NextResponse.json({ workflow: clonedWorkflow });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Workflow API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 