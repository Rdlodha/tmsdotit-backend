const nodemailer = require("nodemailer");

/**
 * Send an email using Nodemailer.
 * @param {{ to: string, subject: string, text?: string, html?: string }} options
 */
async function sendEmail({ to, subject, text, html }) {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        port: 465,
        secure: false, // use SSL
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        family: 4,
    
    });

    const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
        text,
        html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    return info;
}

module.exports = sendEmail;
