import nodemailer from 'nodemailer';
import env from '../config/env';
import logger from '../utils/logger';

interface SendEmailInput {
    to: string;
    subject: string;
    html: string;
    text: string;
}

const smtpConfigured = Boolean(
    env.SMTP_HOST &&
    env.SMTP_PORT &&
    env.SMTP_USER &&
    env.SMTP_PASS &&
    env.MAIL_FROM
);

const transporter = smtpConfigured
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT),
        secure: Number(env.SMTP_PORT) === 465,
        auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
        },
    })
    : null;

export const isEmailConfigured = (): boolean => smtpConfigured && Boolean(transporter);

export const sendEmail = async ({ to, subject, html, text }: SendEmailInput): Promise<void> => {
    if (!transporter || !env.MAIL_FROM) {
        throw new Error('Email transport is not configured.');
    }

    await transporter.sendMail({
        from: env.MAIL_FROM,
        to,
        subject,
        html,
        text,
    });
};

export const logEmailConfigurationWarning = (): void => {
    if (isEmailConfigured()) return;

    logger.warn('SMTP email transport is not configured. Order confirmation emails are disabled.', {
        smtpHost: env.SMTP_HOST,
        smtpPort: env.SMTP_PORT,
        mailFrom: env.MAIL_FROM,
    });
};
