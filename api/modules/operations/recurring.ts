import type { Db, ObjectId } from "mongodb";

function advance(date: Date, frequency: string, interval: number) {
  const result = new Date(date);
  if (frequency === "daily") result.setUTCDate(result.getUTCDate() + interval);
  else if (frequency === "weekly") result.setUTCDate(result.getUTCDate() + 7 * interval);
  else if (frequency === "monthly") result.setUTCMonth(result.getUTCMonth() + interval);
  else if (frequency === "quarterly") result.setUTCMonth(result.getUTCMonth() + 3 * interval);
  else result.setUTCFullYear(result.getUTCFullYear() + interval);
  return result;
}

export async function materializeDueRecurring(db: Db, workspaceId: ObjectId) {
  const now = new Date();
  const due = await db
    .collection("recurringTransactions")
    .find({
      workspaceId,
      status: "active",
      autoCreate: true,
      nextRunAt: { $lte: now },
    })
    .limit(100)
    .toArray();

  for (const item of due) {
    const transactionDate = new Date(item.nextRunAt);
    const upcoming = advance(transactionDate, item.frequency, item.interval);
    const claimed = await db
      .collection("recurringTransactions")
      .updateOne(
        { _id: item._id, nextRunAt: item.nextRunAt, status: "active" },
        { $set: { lastRunAt: transactionDate, nextRunAt: upcoming, updatedAt: now } },
      );
    if (!claimed.modifiedCount) continue;
    await db.collection("transactions").insertOne({
      workspaceId: item.workspaceId,
      accountId: item.accountId,
      categoryId: item.categoryId,
      type: "expense",
      title: item.title,
      ...(item.description ? { description: item.description } : {}),
      amountMinor: item.amountMinor,
      currency: item.currency,
      transactionDate,
      paymentMethod: "other",
      status: "completed",
      tags: [],
      recurringTransactionId: item._id,
      source: "recurring",
      createdBy: item.createdBy,
      createdAt: now,
      updatedAt: now,
    });
  }
}
