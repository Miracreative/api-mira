const { requestHandlerLogin } = require("../controller/LoginController");
const { requestHandlerSendEmail } = require("../controller/emailController");
const authorsController = require("../controller/authorsController");
const postsController = require("../controller/postsController");

const routing = {
    "/": "homepage, go to another route",
    "/api/login": requestHandlerLogin,
    "/api/login/": requestHandlerLogin,
    "/api/send-email": requestHandlerSendEmail,
    "/api/send-email/": requestHandlerSendEmail,
    "/api/db/authors": authorsController.getAllAuthors,
    "/api/db/authors/": authorsController.getAllAuthors,
    "/api/db/posts": postsController.getAllPosts,
    "/api/db/posts/": postsController.getAllPosts,
    "/api/db/posts/:slug": postsController.getOnePostBySlug,
};

module.exports = {
    routing,
};
