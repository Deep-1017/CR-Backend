import nodemailer, { type Transporter } from 'nodemailer';
import path from 'path';
import fs from 'fs/promises';
import env from '../config/env';
import logger from '../utils/logger';
import type { IUser } from '../models/user.model';
import type { IOrder } from '../models/order.model';

export type TrackingInfo = {
  trackingNumber: string;
  trackingUrl?: string;
  carrier?: string;
  carrierName?: string;
  estimatedDeliveryDate?: string;
};

export type EmailSendResult =
  | { ok: true }
  | { ok: false; error: string };

type TemplateName = 'orderConfirmation.html' | 'orderShipped.html' | 'orderDelivered.html' | 'passwordReset.html';

const smtpConfigured = Boolean(
  env.SMTP_HOST &&
    env.SMTP_PORT &&
    env.SMTP_USER &&
    env.SMTP_PASS &&
    env.MAIL_FROM
);

let transporter: Transporter | null = null;
let verifiedOnce = false;
const templateCache = new Map<TemplateName, string>();

const getTransporter = (): Transporter | null => {
  if (!smtpConfigured) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: Number(env.SMTP_PORT) === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return transporter;
};

export const isEmailConfigured = (): boolean => smtpConfigured && Boolean(getTransporter());

export const logEmailConfigurationWarning = (): void => {
  if (isEmailConfigured()) return;

  logger.warn('SMTP email transport is not configured. Email delivery is disabled.', {
    smtpHost: env.SMTP_HOST,
    smtpPort: env.SMTP_PORT,
    mailFrom: env.MAIL_FROM,
  });
};

const verifyTransporterIfNeeded = async (tx: Transporter): Promise<void> => {
  if (verifiedOnce) return;
  try {
    await tx.verify();
    verifiedOnce = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('SMTP transporter verification failed', { error: message });
    // do not throw; sending will still attempt and surface per-email errors
    verifiedOnce = true;
  }
};

const firstExistingFile = async (candidates: string[]): Promise<string | null> => {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // continue
    }
  }
  return null;
};

const readTemplate = async (name: TemplateName): Promise<string> => {
  const cached = templateCache.get(name);
  if (cached) return cached;

  const candidates = [
    // When running compiled JS: dist/services -> dist/templates
    path.resolve(__dirname, '..', 'templates', name),
    // When running from repo root
    path.resolve(process.cwd(), 'CR-Backend', 'src', 'templates', name),
    path.resolve(process.cwd(), 'src', 'templates', name),
    // If you ever copy templates into dist manually
    path.resolve(process.cwd(), 'CR-Backend', 'dist', 'templates', name),
    path.resolve(process.cwd(), 'dist', 'templates', name),
  ];

  const existing = await firstExistingFile(candidates);
  if (!existing) {
    const message = `Email template not found: ${name}`;
    logger.error(message, { candidates });
    // Return a safe minimal HTML so callers never crash.
    return `<html><body><p>${message}</p></body></html>`;
  }

  const html = await fs.readFile(existing, 'utf8');
  templateCache.set(name, html);
  return html;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const applyTemplateVariables = (template: string, variables: Record<string, string>): string => {
  let output = template;
  for (const [key, value] of Object.entries(variables)) {
    const safeValue = value ?? '';
    output = output.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), safeValue);
  }
  return output;
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (value?: Date): string => {
  if (!value) return '';
  // Use a stable, readable format in emails.
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(value);
};

const addBusinessDays = (start: Date, businessDaysToAdd: number): Date => {
  const result = new Date(start);
  // normalize time so date math is stable across environments
  result.setHours(12, 0, 0, 0);

  let remaining = businessDaysToAdd;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay(); // 0=Sun .. 6=Sat
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }

  return result;
};

const estimateDeliveryDateRange = (today: Date): string => {
  const earliest = addBusinessDays(today, 3);
  const latest = addBusinessDays(today, 5);
  const earliestLabel = formatDate(earliest);
  const latestLabel = formatDate(latest);
  if (!earliestLabel) return latestLabel;
  if (earliestLabel === latestLabel) return earliestLabel;
  return `${earliestLabel} - ${latestLabel}`;
};

const buildShippingAddress = (order: IOrder): string => {
  const parts = [
    order.customer?.address,
    [order.customer?.city, order.customer?.state].filter(Boolean).join(', ').trim(),
    order.customer?.zipCode,
  ]
    .map((v) => (v || '').trim())
    .filter(Boolean);

  // Keep this HTML small and email-safe.
  return parts.map(escapeHtml).join('<br />');
};

const getOrderUrl = (orderId: string): string =>
  env.FRONTEND_URL ? `${env.FRONTEND_URL}/orders/${orderId}` : orderId;

const buildItemsRowsHtml = (order: IOrder): string =>
  order.items
    .map((item) => {
      const name = escapeHtml(item.name);
      const details = escapeHtml(`${item.finish} / ${item.configuration}`);
      const qty = String(item.quantity);
      const total = formatCurrency(item.priceAtPurchase * item.quantity);

      return `
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #e7e5e4;">
            ${name}
          </td>
          <td style="padding:12px 14px;border-bottom:1px solid #e7e5e4;color:#78716c;font-size:12px;">
            ${details}
          </td>
          <td style="padding:12px 14px;border-bottom:1px solid #e7e5e4;text-align:center;">${qty}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #e7e5e4;text-align:right;">${total}</td>
        </tr>
      `.trim();
    })
    .join('');

const buildItemsRowsHtmlNoPrice = (order: IOrder): string =>
  order.items
    .map((item) => {
      const name = escapeHtml(item.name);
      const details = escapeHtml(`${item.finish} / ${item.configuration}`);
      const qty = String(item.quantity);
      return `
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #e7e5e4;">${name}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #e7e5e4;color:#78716c;font-size:12px;">${details}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #e7e5e4;text-align:center;">${qty}</td>
        </tr>
      `.trim();
    })
    .join('');

export const sendEmail = async (input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailSendResult> => {
  const tx = getTransporter();
  if (!tx || !env.MAIL_FROM) {
    logEmailConfigurationWarning();
    return { ok: false, error: 'Email transport is not configured.' };
  }

  try {
    await verifyTransporterIfNeeded(tx);
    await tx.sendMail({
      from: env.MAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Email send failed', {
      error: message,
      to: input.to,
      subject: input.subject,
    });
    return { ok: false, error: message };
  }
};

export const sendOrderConfirmationEmail = async (user: Pick<IUser, 'email' | 'name'>, order: IOrder): Promise<EmailSendResult> => {
  const template = await readTemplate('orderConfirmation.html');
  const customerName = (order.customer?.firstName || user.name || 'there').trim();
  const orderNumber = order.id;
  const orderDate = formatDate(order.createdAt);
  const items = buildItemsRowsHtml(order);
  const subtotal = formatCurrency(order.totalAmount ?? 0);
  const shippingCost = formatCurrency(0);
  const tax = formatCurrency(0);
  const totalAmount = formatCurrency(order.amountPaid || order.totalAmount || 0);
  const orderUrl = getOrderUrl(orderNumber);
  const shippingAddress = buildShippingAddress(order);
  const estimatedDeliveryDate = estimateDeliveryDateRange(new Date());

  const html = applyTemplateVariables(template, {
    customerName: escapeHtml(customerName),
    orderNumber: escapeHtml(orderNumber),
    orderDate: escapeHtml(orderDate),
    items,
    subtotal: escapeHtml(subtotal),
    shippingCost: escapeHtml(shippingCost),
    tax: escapeHtml(tax),
    totalAmount: escapeHtml(totalAmount),
    shippingAddress,
    estimatedDeliveryDate: escapeHtml(estimatedDeliveryDate),
    orderUrl: escapeHtml(orderUrl),
  });

  return sendEmail({
    to: user.email,
    subject: `Your CR Music order ${orderNumber} is confirmed`,
    html,
    text: `Order confirmed: ${orderNumber}\nAmount paid: ${totalAmount}\nView order: ${orderUrl}`,
  });
};

export const sendOrderShippedEmail = async (
  user: Pick<IUser, 'email' | 'name'>,
  order: IOrder,
  trackingInfo: TrackingInfo
): Promise<EmailSendResult> => {
  const template = await readTemplate('orderShipped.html');
  const customerName = (order.customer?.firstName || user.name || 'there').trim();
  const orderNumber = order.id;
  const orderUrl = getOrderUrl(orderNumber);
  const trackingNumber = trackingInfo.trackingNumber || 'N/A';
  const trackingUrl = trackingInfo.trackingUrl || orderUrl;
  const carrierName = trackingInfo.carrierName || trackingInfo.carrier || '';
  const estimatedDeliveryDate = trackingInfo.estimatedDeliveryDate || '';
  const items = buildItemsRowsHtmlNoPrice(order);

  const html = applyTemplateVariables(template, {
    customerName: escapeHtml(customerName),
    orderNumber: escapeHtml(orderNumber),
    carrierName: escapeHtml(carrierName),
    trackingNumber: escapeHtml(trackingNumber),
    trackingUrl: escapeHtml(trackingUrl),
    estimatedDeliveryDate: escapeHtml(estimatedDeliveryDate),
    orderUrl: escapeHtml(orderUrl),
    items,
  });

  return sendEmail({
    to: user.email,
    subject: `Your CR Music order ${orderNumber} has shipped`,
    html,
    text: `Order shipped: ${orderNumber}\nTracking: ${trackingNumber}\nTrack: ${trackingUrl}`,
  });
};

export const sendOrderDeliveredEmail = async (
  user: Pick<IUser, 'email' | 'name'>,
  order: IOrder
): Promise<EmailSendResult> => {
  const template = await readTemplate('orderDelivered.html');
  const customerName = (order.customer?.firstName || user.name || 'there').trim();
  const orderNumber = order.id;
  const orderUrl = getOrderUrl(orderNumber);
  const items = buildItemsRowsHtmlNoPrice(order);
  const itemsCount = String(order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) ?? 0);
  const totalAmount = formatCurrency(order.amountPaid || order.totalAmount || 0);
  const deliveryDate = formatDate(new Date());
  const feedbackUrl = env.FRONTEND_URL ? `${env.FRONTEND_URL}/reviews?orderId=${encodeURIComponent(orderNumber)}` : '';

  const html = applyTemplateVariables(template, {
    customerName: escapeHtml(customerName),
    orderNumber: escapeHtml(orderNumber),
    orderUrl: escapeHtml(orderUrl),
    items,
    itemsCount: escapeHtml(itemsCount),
    totalAmount: escapeHtml(totalAmount),
    deliveryDate: escapeHtml(deliveryDate),
    feedbackUrl: escapeHtml(feedbackUrl),
  });

  return sendEmail({
    to: user.email,
    subject: `Delivered: your CR Music order ${orderNumber}`,
    html,
    text: `Delivered: ${orderNumber}\nView order: ${orderUrl}`,
  });
};
