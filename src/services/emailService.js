const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const sendEmail = async (options) => {
    // Basic mock if no SMTP configuration is present
    if (!process.env.SMTP_HOST) {
        logger.info('---------------------------------------------------');
        logger.info('MOCK EMAIL NOTIFICATION');
        logger.info(`To: ${options.to}`);
        logger.info(`Subject: ${options.subject}`);
        logger.info(`Message: ${options.text || options.html}`);
        logger.info('---------------------------------------------------');
        return Promise.resolve();
    }

    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        const mailOptions = {
            from: process.env.SMTP_FROM || '"Temple B\'nai Israel" <no-reply@florencetemple.org>',
            ...options
        };

        const info = await transporter.sendMail(mailOptions);
        logger.info(`Email sent: ${info.messageId}`);
        return info;
    } catch (error) {
        logger.error('Error sending email', { error });
        // Do not throw, just log.
        return Promise.resolve();
    }
};

exports.sendContactNotification = async (message) => {
    return sendEmail({
        to: process.env.CONTACT_EMAIL || process.env.SMTP_USER,
        subject: `[Web Temple] New Contact: ${message.subject}`,
        text: `You have received a new message from the contact form.\n\nFrom: ${message.name} (${message.email})\nSubject: ${message.subject}\n\nMessage:\n${message.message}`,
        html: `<h3>New Contact Message</h3>
               <p><strong>From:</strong> ${message.name} (<a href="mailto:${message.email}">${message.email}</a>)</p>
               <p><strong>Subject:</strong> ${message.subject}</p>
               <hr>
               <p style="white-space: pre-wrap;">${message.message}</p>`
    });
};

exports.sendEmail = sendEmail;
