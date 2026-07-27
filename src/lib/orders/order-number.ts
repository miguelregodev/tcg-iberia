import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * Generates a unique order identifier.
 *
 * We generate identifiers using a database-backed sequence to guarantee
 * uniqueness across multiple application instances.
 *
 * Format:
 *
 *   12-digit sequence
 *
 * Example:
 *
 *   000000000001
 *   000000000002
 */
const SEQUENCE_NAME = 'ORDER';

export async function getNextOrderNumber(
  tx: Prisma.TransactionClient = db,
): Promise<string> {
    const nextValue = await db.$transaction(async (tx) => {
      await tx.sequence.upsert({
        where: { name: 'ORDER' },
        create: {
            name: 'ORDER',
            value: 1,
        },
        update: {
            value: {
                increment: 1,
            },
        },
    });

      const updated = await tx.sequence.update({
        where: {
          name: SEQUENCE_NAME,
        },
        data: {
          value: {
            increment: 1,
          },
        },
      });

      return updated.value;
    });

    return nextValue.toString().padStart(12, '0');

  }
