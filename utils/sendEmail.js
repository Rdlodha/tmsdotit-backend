const nodemailer = require("nodemailer");

async function sendEmail({ to, subject, text, html }) {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
        text,
        html,
    };

    const info = await transporter.sendMail(mailOptions);
    return info;
}

module.exports = sendEmail;
