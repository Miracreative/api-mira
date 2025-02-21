const dotenv = require("dotenv");
dotenv.config();

const requestHandlerLogin = (req, res) => {
    console.log("I'm here in login");
    console.log("req", req);
    if (req.method === "OPTIONS") {
        return res.status(204).end(); // No Content
    }

    if (req.method === "GET") {
        return res.status(405).send("<h1>Method not allowed</h1>");
    }

    if (req.method === "POST") {
        const { login, password } = req.body; // теперь req.body будет доступно после использования express.json()

        if (!login || !password) {
            return res.status(400).json({
                message: `${!login ? "login" : "password"} is required`,
                isAuth: false,
            });
        }

        if (login === process.env.LOGIN && password === process.env.PASSWORD) {
            console.log("Login successful");
            return res.status(200).json({
                message: "Login successful",
                isAuth: true,
            });
        } else {
            return res.status(401).json({
                message: "Invalid login or password",
                isAuth: false,
            });
        }
    }
};

module.exports = {
    requestHandlerLogin,
};
