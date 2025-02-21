const express = require("express");
const cors = require("cors");
const path = require("path");
const { requestHandlerLogin } = require("./controller/loginController");
const { requestHandlerSendEmail } = require("./controller/emailController");
const authorsController = require("./controller/authorsController");
const postsController = require("./controller/postsController");
const categoriesController = require("./controller/categoriesController");
var multer = require("multer");
let upload = multer();
const app = express();

const setHeaders = (req, res, next) => {
    if (req.path.startsWith("/api/")) {
        res.setHeader("Content-Type", "application/json");
    }
    next();
};

// Применяем middleware для всех запросов
app.use(cors());
app.use(setHeaders);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json({ limit: "50mb" }));
// Основные маршруты
app.get("/", (req, res) => {
    res.send("homepage, go to another route");
});

// API маршруты
app.post("/api/login", requestHandlerLogin);
app.post("/api/login/", requestHandlerLogin);
app.post("/api/send-email", requestHandlerSendEmail);
app.post("/api/send-email/", requestHandlerSendEmail);

// API для работы с авторами и постами
app.get("/api/db/authors", authorsController.getAllAuthors);
app.get("/api/db/authors/", authorsController.getAllAuthors);
app.get("/api/db/posts", postsController.getAllPosts);
app.get("/api/db/posts/", postsController.getAllPosts);
app.post("/api/db/posts", upload.single("image"), postsController.setNewPost);
app.post("/api/db/posts/", upload.single("image"), postsController.setNewPost);
app.put(
    "/api/db/posts/:slug",
    upload.single("image"),
    postsController.updatePostBySlug
);
app.delete("/api/db/posts/:slug", postsController.deletePostById);
app.get("/api/db/posts/:slug", postsController.getOnePostBySlug);
app.get("/api/db/categories", categoriesController.getAllCategories);

// Обработчик ошибок 404

app.use((req, res) => {
    res.status(404).send("Not Found");
});

// Обработчик ошибок 500
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send("Internal Server Error in index");
});

// Запуск сервера
const port = 5555;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
