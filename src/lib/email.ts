// Email service for password reset
// This is a template for implementing real email functionality

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

class EmailService {
  // Option 1: Using a service like Resend, SendGrid, or Nodemailer
  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      // Example using a hypothetical email API
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      console.error('Email sending error:', error);
      throw error;
    }
  }

  // Generate password reset email HTML
  generateResetEmailHTML(resetLink: string, userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Quiz System</h1>
            <p>Password Reset Request</p>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>You requested to reset your password for your Quiz System account. Click the button below to reset your password:</p>
            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </div>
            <p>If you didn't request this password reset, you can safely ignore this email. The link will expire in 1 hour.</p>
            <p>For security reasons, please make sure:</p>
            <ul>
              <li>You're on a secure device</li>
              <li>The link in your browser address bar starts with your website domain</li>
              <li>You don't share this link with anyone</li>
            </ul>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; 2024 Quiz System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Send password reset email
  async sendPasswordResetEmail(email: string, resetToken: string, userName: string): Promise<void> {
    const resetLink = `${window.location.origin}/reset-password?token=${resetToken}`;
    
    const emailOptions: EmailOptions = {
      to: email,
      subject: 'Reset Your Quiz System Password',
      html: this.generateResetEmailHTML(resetLink, userName),
    };

    await this.sendEmail(emailOptions);
  }
}

export const emailService = new EmailService();

// For demo purposes, you can also create a simple console-based email logger
export class ConsoleEmailService {
  async sendPasswordResetEmail(email: string, resetToken: string, userName: string): Promise<void> {
    const resetLink = `${window.location.origin}/reset-password?token=${resetToken}`;
    
    console.log('=== PASSWORD RESET EMAIL ===');
    console.log('To:', email);
    console.log('Subject: Reset Your Quiz System Password');
    console.log('Reset Link:', resetLink);
    console.log('User:', userName);
    console.log('========================');
    
    // In development, you could open the reset link automatically
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode - Auto-opening reset link in browser...');
      // window.open(resetLink, '_blank');
    }
  }
}
