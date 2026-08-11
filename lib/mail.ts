import nodemailer from 'nodemailer'
import { logger } from '@/lib/logger'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const from = process.env.EMAIL_FROM || '"AttireLab" <noreply@attirelab.com>'

  const mailOptions = {
    from,
    to: email,
    subject: 'Reset your AttireLab Password',
    text: `You requested a password reset. Please click the following link to reset your password: ${resetUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #3b82f6;">Password Reset Request</h2>
        <p>You recently requested to reset your password for your AttireLab account. Click the button below to reset it.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 14px; color: #6b7280;">If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    logger.warn({ email, resetUrl }, 'SMTP credentials not configured. Email dispatch skipped.')
    return
  }

  try {
    await transporter.sendMail(mailOptions)
    logger.info({ email }, 'Password reset email sent successfully')
  } catch (err) {
    logger.error({ err, email }, 'Failed to send password reset email')
    throw err
  }
}
