import prisma from '../lib/db';

export async function getQueuePosition(requestId: string): Promise<number> {
  const request = await prisma.tractorRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== 'pending') return -1;

  const ahead = await prisma.tractorRequest.count({
    where: {
      status: 'pending',
      OR: [
        { priority: { gt: request.priority } },
        { priority: request.priority, createdAt: { lt: request.createdAt } },
      ],
    },
  });

  return ahead + 1;
}

export async function getEstimatedWait(requestId: string): Promise<number> {
  const position = await getQueuePosition(requestId);
  if (position <= 0) return 0;
  // Estimate 15 minutes per request
  return position * 15;
}
