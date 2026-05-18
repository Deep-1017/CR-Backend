import mongoose, { Document, Schema } from 'mongoose';

export interface IProcessedWebhookEvent extends Document {
  eventId: string;
  processedAt: Date;
}

const ProcessedWebhookEventSchema = new Schema<IProcessedWebhookEvent>(
  {
    eventId: {
      type: String,
      required: [true, 'Event ID is required'],
      unique: true,
      index: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // No updatedAt needed — these records are write-once
    timestamps: false,
  }
);

export default mongoose.model<IProcessedWebhookEvent>(
  'ProcessedWebhookEvent',
  ProcessedWebhookEventSchema
);
