const nodemailer = require('nodemailer');

exports.sendContactNotification = async (message) => {
    // Basic mock if no SMTP configuration is present
    if (!process.env.SMTP_HOST) {
        console.log('---------------------------------------------------');
        console.log('MOCK EMAIL NOTIFICATION');
        console.log('To: Admin');
        console.log(`Subject: New Contact Message - ${message.subject}`);
        console.log(`From: ${message.name} <${message.email}>`);
        console.log(`Message: ${message.message}`);
        console.log('---------------------------------------------------');
        return;
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
            from: process.env.SMTP_FROM || '"Temple Website" <no-reply@hattiesburgtemple.com>',
            to: process.env.CONTACT_EMAIL || process.env.SMTP_USER, // Fallback to SMTP user logic
            subject: `[Web Temple] New Contact: ${message.subject}`,
            text: `You have received a new message from the contact form.\n\nFrom: ${message.name} (${message.email})\nSubject: ${message.subject}\n\nMessage:\n${message.message}`,
            html: `<h3>New Contact Message</h3>
                   <p><strong>From:</strong> ${message.name} (<a href="mailto:${message.email}">${message.email}</a>)</p>
                   <p><strong>Subject:</strong> ${message.subject}</p>
                   <hr>
                   <p style="white-space: pre-wrap;">${message.message}</p>`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        // Do not throw, just log. We don't want to fail the user request if notification fails.
        // Or maybe we should? The plan said "fail gracefully".
    }
};
