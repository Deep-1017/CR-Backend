import mongoose, { Document, Schema, Types } from 'mongoose';

// ─── Indian States Enum ──────────────────────────────────────────────────────
export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

export const SUPPORTED_COUNTRIES = ['India'] as const;
export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

// ─── Interface ───────────────────────────────────────────────────────────────
export interface IAddress extends Document {
  userId: Types.ObjectId;
  label: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: IndianState;
  zipCode: string;
  country: SupportedCountry;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ──────────────────────────────────────────────────────────────────
const AddressSchema = new Schema<IAddress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    label: {
      type: String,
      required: [true, 'Address label is required'],
      trim: true,
      maxlength: [50, 'Label cannot exceed 50 characters'],
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^\d{10}$/, 'Phone number must be exactly 10 digits'],
    },
    addressLine1: {
      type: String,
      required: [true, 'Address line 1 is required'],
      trim: true,
      maxlength: [200, 'Address line 1 cannot exceed 200 characters'],
    },
    addressLine2: {
      type: String,
      trim: true,
      maxlength: [200, 'Address line 2 cannot exceed 200 characters'],
      default: '',
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [100, 'City cannot exceed 100 characters'],
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
      enum: {
        values: INDIAN_STATES as unknown as string[],
        message: '{VALUE} is not a valid Indian state',
      },
    },
    zipCode: {
      type: String,
      required: [true, 'Zip code is required'],
      trim: true,
      match: [/^\d{6}$/, 'Zip code must be exactly 6 digits'],
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
      enum: {
        values: SUPPORTED_COUNTRIES as unknown as string[],
        message: '{VALUE} is not a supported country',
      },
      default: 'India',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const obj = ret as any;
        delete obj.__v;
        return ret;
      },
    },
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
// Compound index for faster user-specific address queries
AddressSchema.index({ userId: 1, _id: 1 });

// Partial unique index: only one default address per user
// This ensures at most one document per userId where isDefault === true
AddressSchema.index(
  { userId: 1, isDefault: 1 },
  {
    unique: true,
    partialFilterExpression: { isDefault: true },
  }
);

// ─── Pre-save Hook ───────────────────────────────────────────────────────────
// When setting an address as default, unset the previous default for this user
AddressSchema.pre('save', async function (next) {
  if (this.isModified('isDefault') && this.isDefault) {
    const AddressModel = this.constructor as mongoose.Model<IAddress>;
    const session = (this as any).$session?.() as mongoose.ClientSession | undefined;
    await AddressModel.updateMany(
      { userId: this.userId, _id: { $ne: this._id }, isDefault: true },
      { $set: { isDefault: false } }
      , session ? { session } : undefined
    );
  }
  next();
});

// ─── Pre findOneAndUpdate Hook ───────────────────────────────────────────────
// Handle isDefault toggling via findOneAndUpdate operations
AddressSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() as Record<string, unknown> | null;
  if (!update) return next();

  const isDefaultUpdate =
    (update as any).isDefault ?? (update as any).$set?.isDefault;

  if (isDefaultUpdate === true) {
    const filter = this.getFilter();
    const AddressModel = this.model;
    const session = (this as any).getOptions?.()?.session as mongoose.ClientSession | undefined;
    await AddressModel.updateMany(
      { userId: filter.userId, _id: { $ne: filter._id }, isDefault: true },
      { $set: { isDefault: false } }
      , session ? { session } : undefined
    );
  }
  next();
});

export default mongoose.model<IAddress>('Address', AddressSchema);
