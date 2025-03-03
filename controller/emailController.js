const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

const transporter = nodemailer.createTransport({
    host: "smtp.yandex.ru",
    port: 465,
    secure: true,
    auth: {
        user: process.env.AUTH_MAIL_USER,
        pass: process.env.AUTH_MAIL_PASS,
    },
});

const requestHandlerSendEmail = async (req, res) => {
    if (req.method === "GET") {
        return res.status(405).send("<h1>Method not allowed</h1>");
    }

    if (req.method === "POST") {
        console.log("in post !");
        try {
            console.log("До верификации");
            const userData = req.body;
            const transportVerifier = (error, success) => {
                if (error) {
                    console.log("Transport failure:", error);
                    return error;
                }
                console.log("Success =", success); //This gets asynchronously printed
                return success;
            };
            const validTransporter = await transporter.verify(
                transportVerifier
            );

            console.log("Server is ready to take our messages");
            // Отправка email
            await transporter.sendMail({
                from: "sgedexpo@yandex.ru",
                to: "sgedexpo@yandex.ru",
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
