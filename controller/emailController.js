const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    secure: false,
    auth: {
        user: "306c14ea893372",
        pass: "fd123a07a02b7e",
    },
});

const requestHandlerSendEmail = async (req, res) => {
    if (req.method === "GET") {
        return res.status(405).send("<h1>Method not allowed</h1>");
    }

    if (req.method === "POST") {
        try {
            const userData = req.body;
            await transporter.verify();
            console.log("Server is ready to take our messages");

            // Отправка email
            await transporter.sendMail({
                from: "mira-dev@mail.ru",
                to: "79105871051@yandex.ru",
                subject: "Новый клиент!",
                text: `Имя: ${userData.name} Номер: ${userData.tel} Email: ${userData.email} `,
            });

            res.status(200).json({
                success: true,
                message: "Email sent successfully!",
            });
        } catch (error) {
            console.error("Error sending email:", error);
            res.status(500).json({
                success: false,
                message: "Failed to send email.",
            });
        }
    }
};

module.exports = {
    requestHandlerSendEmail,
};
